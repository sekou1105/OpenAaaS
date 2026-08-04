//! CAS 统一认证集成测试
//!
//! 通过测试文件内置的轻量 CAS stub（内存态、随机端口）验证注册/登录的统一认证流程。
//! stub 仅存在于测试中，不属于产品代码。

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{Request, StatusCode};
use axum::response::IntoResponse;
use axum::{Router, routing::{get, post}};
use http_body_util::BodyExt;
use serde_json::json;
use tower::ServiceExt;

use super::{TestApp, UserResponse, auth_header};

/// stub 中的有效密码
const STUB_VALID_PASSWORD: &str = "testpass";

// ============================================================================
// 测试专用 CAS stub（仅本文件内使用）
// ============================================================================

#[derive(Default)]
struct StubState {
    tgts: HashMap<String, String>, // tgt -> username
    sts: HashMap<String, String>,  // st  -> username
    /// 为 true 时换 ST 一律返回 400（模拟 service 未授权）
    st_always_fail: bool,
}

type Shared = Arc<Mutex<StubState>>;

async fn stub_get_tgt(State(st): State<Shared>, body: String) -> impl IntoResponse {
    // 手工解析 application/x-www-form-urlencoded（本 stub 字段仅 username/password，无特殊字符）
    let params: HashMap<String, String> = body
        .split('&')
        .filter_map(|kv| {
            let (k, v) = kv.split_once('=')?;
            Some((k.to_string(), v.to_string()))
        })
        .collect();
    let username = params.get("username").cloned().unwrap_or_default();
    let password = params.get("password").cloned().unwrap_or_default();
    if username.is_empty() || password != STUB_VALID_PASSWORD {
        return (StatusCode::BAD_REQUEST, "无效的用户名或密码".to_string()).into_response();
    }
    let tgt = format!("TGT-{}", uuid::Uuid::new_v4());
    st.lock().unwrap().tgts.insert(tgt.clone(), username);
    (
        StatusCode::CREATED,
        [(axum::http::header::LOCATION, format!("/v1/tickets/{}", tgt))],
        "TGT Created".to_string(),
    )
        .into_response()
}

async fn stub_get_st(State(st): State<Shared>, Path(tgt): Path<String>) -> impl IntoResponse {
    let mut state = st.lock().unwrap();
    if state.st_always_fail {
        return (StatusCode::BAD_REQUEST, "CAS is unable to process this request").into_response();
    }
    let Some(username) = state.tgts.get(&tgt).cloned() else {
        return (StatusCode::NOT_FOUND, "TGT 不存在").into_response();
    };
    let st_id = format!("ST-{}", uuid::Uuid::new_v4());
    state.sts.insert(st_id.clone(), username);
    (StatusCode::OK, st_id).into_response()
}

async fn stub_validate(
    State(st): State<Shared>,
    Query(q): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let ticket = q.get("ticket").cloned().unwrap_or_default();
    let username = st.lock().unwrap().sts.remove(&ticket); // ST 一次性
    match username {
        Some(u) => format!(
            "<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>\
             <cas:authenticationSuccess><cas:user>{}</cas:user>\
             <cas:name>测试用户</cas:name><cas:employeeNumber>20240001</cas:employeeNumber>\
             </cas:authenticationSuccess></cas:serviceResponse>",
            u
        ),
        None => "<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>\
                 <cas:authenticationFailure code=\"INVALID_TICKET\">票据无效或已被使用</cas:authenticationFailure>\
                 </cas:serviceResponse>"
            .to_string(),
    }
}

fn stub_router(st_always_fail: bool) -> Router {
    let state: Shared = Arc::new(Mutex::new(StubState {
        st_always_fail,
        ..Default::default()
    }));
    Router::new()
        .route("/v1/tickets", post(stub_get_tgt))
        .route("/v1/tickets/{tgt}", post(stub_get_st))
        .route("/serviceValidate", get(stub_validate))
        .with_state(state)
}

/// 启动内存 CAS stub，返回监听地址
async fn start_stub_cas(st_always_fail: bool) -> std::net::SocketAddr {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, stub_router(st_always_fail)).await.unwrap();
    });
    addr
}

/// 创建启用 CAS 的测试应用（CAS 指向内存 stub）
async fn create_cas_test_app() -> TestApp {
    let cas_addr = start_stub_cas(false).await;
    let mut config = TestApp::default_config();
    config.cas.enabled = true;
    config.cas.server_url = format!("http://{}", cas_addr);
    config.cas.service_url = "http://test.local/cas".to_string();
    TestApp::with_config(config).await
}

/// POST JSON 请求，返回 (状态码, 响应 JSON)
async fn post_json(app: &TestApp, uri: &str, body: &serde_json::Value) -> (StatusCode, serde_json::Value) {
    let response = app
        .router
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let json = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
    (status, json)
}

/// 带 API Key 的 GET 请求，返回状态码
async fn get_with_auth(app: &TestApp, uri: &str, api_key: &str) -> StatusCode {
    let (name, value) = auth_header(api_key);
    let response = app
        .router
        .clone()
        .oneshot(
            Request::builder()
                .uri(uri)
                .header(name, value)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    response.status()
}

// ============================================================================
// 注册 + CAS 测试
// ============================================================================

#[tokio::test]
async fn test_register_with_valid_cas_credentials() {
    let app = create_cas_test_app().await;

    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/register",
        &json!({"name": "casuser1", "password": STUB_VALID_PASSWORD}),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let user: UserResponse = serde_json::from_value(body).unwrap();
    assert_eq!(user.name, "casuser1");
    assert!(user.api_key.starts_with("ak_client_"));
    assert_eq!(user.role, "client");

    app.cleanup().await;
}

#[tokio::test]
async fn test_register_with_invalid_cas_password() {
    let app = create_cas_test_app().await;

    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/register",
        &json!({"name": "casuser2", "password": "wrongpass"}),
    )
    .await;

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["message"], "统一认证失败：用户名或密码错误");

    app.cleanup().await;
}

#[tokio::test]
async fn test_register_without_password_when_cas_enabled() {
    let app = create_cas_test_app().await;

    let (status, _body) = post_json(
        &app,
        "/api/v1/client/auth/register",
        &json!({"name": "casuser3"}),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);

    app.cleanup().await;
}

#[tokio::test]
async fn test_register_service_not_authorized() {
    // CAS 侧拒绝签发 ST（service 未注册）→ 502 + 明确错误信息
    let cas_addr = start_stub_cas(true).await;
    let mut config = TestApp::default_config();
    config.cas.enabled = true;
    config.cas.server_url = format!("http://{}", cas_addr);
    config.cas.service_url = "http://unregistered.example.com".to_string();
    let app = TestApp::with_config(config).await;

    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/register",
        &json!({"name": "casuser4", "password": STUB_VALID_PASSWORD}),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert_eq!(body["message"], "应用未授权：service 未在统一认证平台注册");

    app.cleanup().await;
}

// ============================================================================
// 登录 + CAS 测试
// ============================================================================

#[tokio::test]
async fn test_login_success_rotates_api_key() {
    let app = create_cas_test_app().await;

    // 先注册
    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/register",
        &json!({"name": "loginuser1", "password": STUB_VALID_PASSWORD}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let old_key = body["api_key"].as_str().unwrap().to_string();

    // 旧 Key 此时可用
    assert_eq!(
        get_with_auth(&app, "/api/v1/client/tasks", &old_key).await,
        StatusCode::OK
    );

    // 登录成功，返回新 API Key
    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/login",
        &json!({"name": "loginuser1", "password": STUB_VALID_PASSWORD}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let user: UserResponse = serde_json::from_value(body).unwrap();
    assert_eq!(user.name, "loginuser1");
    assert!(user.api_key.starts_with("ak_client_"));
    assert_ne!(user.api_key, old_key);

    // 旧 Key 已失效，新 Key 可用
    assert_eq!(
        get_with_auth(&app, "/api/v1/client/tasks", &old_key).await,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        get_with_auth(&app, "/api/v1/client/tasks", &user.api_key).await,
        StatusCode::OK
    );

    app.cleanup().await;
}

#[tokio::test]
async fn test_login_with_invalid_cas_password() {
    let app = create_cas_test_app().await;

    // 先注册
    let (status, _body) = post_json(
        &app,
        "/api/v1/client/auth/register",
        &json!({"name": "loginuser2", "password": STUB_VALID_PASSWORD}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // 错误密码登录 → 401
    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/login",
        &json!({"name": "loginuser2", "password": "wrongpass"}),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["message"], "统一认证失败：用户名或密码错误");

    app.cleanup().await;
}

#[tokio::test]
async fn test_login_auto_creates_user_when_cas_enabled() {
    let app = create_cas_test_app().await;

    // 未注册过的用户直接登录：CAS 验证通过后自动创建（等同注册）
    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/login",
        &json!({"name": "newcasuser", "password": STUB_VALID_PASSWORD}),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let user: UserResponse = serde_json::from_value(body).unwrap();
    assert_eq!(user.name, "newcasuser");
    assert!(user.api_key.starts_with("ak_client_"));
    assert_eq!(user.role, "client");

    // 新 Key 可用
    assert_eq!(
        get_with_auth(&app, "/api/v1/client/tasks", &user.api_key).await,
        StatusCode::OK
    );

    app.cleanup().await;
}

// ============================================================================
// 未启用 CAS 时的行为测试
// ============================================================================

#[tokio::test]
async fn test_login_user_not_found_when_cas_disabled() {
    let app = TestApp::new().await; // 默认 cas.enabled = false

    let (status, _body) = post_json(
        &app,
        "/api/v1/client/auth/login",
        &json!({"name": "nobody", "password": "whatever"}),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);

    app.cleanup().await;
}

#[tokio::test]
async fn test_login_success_when_cas_disabled() {
    let app = TestApp::new().await; // 默认 cas.enabled = false

    // 旧行为注册（无需密码）
    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/register",
        &json!({"name": "legacyuser"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let old_key = body["api_key"].as_str().unwrap().to_string();

    // 未启用 CAS 时登录只按 name 查用户，密码不参与验证
    let (status, body) = post_json(
        &app,
        "/api/v1/client/auth/login",
        &json!({"name": "legacyuser", "password": "whatever"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let user: UserResponse = serde_json::from_value(body).unwrap();
    assert_eq!(user.name, "legacyuser");
    assert!(user.api_key.starts_with("ak_client_"));
    assert_ne!(user.api_key, old_key);

    // 旧 Key 失效，新 Key 可用
    assert_eq!(
        get_with_auth(&app, "/api/v1/client/tasks", &old_key).await,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        get_with_auth(&app, "/api/v1/client/tasks", &user.api_key).await,
        StatusCode::OK
    );

    app.cleanup().await;
}
