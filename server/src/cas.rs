//! 校园网 CAS 统一认证客户端（CAS RESTful API）
//!
//! 认证流程（参考统一认证接口文档）：
//! 1. `POST {cas_url}/v1/tickets` 提交用户名/密码，获取 TGT（从 Location 头解析）
//! 2. `POST {cas_url}/v1/tickets/{TGT}` 提交 service，换取 ST
//! 3. `GET {cas_url}/serviceValidate?ticket={ST}&service={service}` 验证 ST，解析 XML 获取用户信息
//!
//! 注意：密码仅用于第 1 步的表单提交，绝不入库、绝不写日志。

use thiserror::Error;

/// CAS 认证错误
#[derive(Debug, Error)]
pub enum CasError {
    /// 凭据无效（用户名或密码错误）
    #[error("统一认证失败：用户名或密码错误")]
    InvalidCredentials,

    /// 应用未授权（service 未在 CAS 白名单注册，换 ST 时被拒绝）
    #[error("应用未授权：service 未在统一认证平台注册")]
    ServiceNotAuthorized,

    /// 账号/请求被锁定（真实 CAS 在短时间内多次取 TGT 后返回 423 Locked）
    #[error("统一认证请求过于频繁，账号已被临时锁定，请稍后再试")]
    Locked,

    /// 网络错误（CAS 服务不可达等）
    #[error("统一认证服务网络错误: {0}")]
    Network(String),

    /// 协议错误（响应格式不符合预期）
    #[error("统一认证协议错误: {0}")]
    Protocol(String),
}

/// CAS 认证通过后返回的用户信息
#[derive(Debug, Clone, PartialEq)]
pub struct CasUser {
    /// 用户名（统一认证账号）
    pub username: String,
    /// 姓名
    pub name: Option<String>,
    /// 工号/学号
    pub employee_number: Option<String>,
}

/// CAS RESTful 客户端
#[derive(Debug, Clone)]
pub struct CasClient {
    /// CAS 服务器地址（已去除尾部 `/`），如 https://sso.buaa.edu.cn
    server_url: String,
    /// 在 CAS 白名单中注册的 service 地址（已去除尾部 `/`）
    service_url: String,
    /// HTTP 客户端
    http: reqwest::Client,
}

impl CasClient {
    /// 创建 CAS 客户端（自动 trim 参数尾部的 `/`）
    pub fn new(server_url: impl Into<String>, service_url: impl Into<String>) -> Self {
        let server_url = server_url.into().trim_end_matches('/').to_string();
        let service_url = service_url.into().trim_end_matches('/').to_string();
        Self {
            server_url,
            service_url,
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("创建 CAS HTTP 客户端失败"),
        }
    }

    /// 验证用户名/密码，成功返回 CAS 用户信息
    pub async fn verify_credentials(
        &self,
        username: &str,
        password: &str,
    ) -> Result<CasUser, CasError> {
        let tgt = self.get_tgt(username, password).await?;
        let st = self.get_st(&tgt).await?;
        self.validate_st(&st).await
    }

    /// 第 1 步：提交凭据获取 TGT
    async fn get_tgt(&self, username: &str, password: &str) -> Result<String, CasError> {
        let resp = self
            .http
            .post(format!("{}/v1/tickets", self.server_url))
            .form(&[("username", username), ("password", password)])
            .send()
            .await
            .map_err(|e| CasError::Network(e.to_string()))?;

        let status = resp.status();
        if status == reqwest::StatusCode::CREATED {
            // 标准方式：从 Location 头解析（北航真实 CAS 即此方式）
            if let Some(location) = resp
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
            {
                return extract_tgt_from_location(location);
            }
            // 兼容旧版 CAS：201 响应体为 HTML，TGT 在 form 的 action 中
            let body = resp
                .text()
                .await
                .map_err(|e| CasError::Network(e.to_string()))?;
            extract_tgt_from_form_action(&body)
        } else if status == reqwest::StatusCode::BAD_REQUEST
            || status == reqwest::StatusCode::UNAUTHORIZED
        {
            // 400/401 均视为凭据无效
            Err(CasError::InvalidCredentials)
        } else if status.as_u16() == 423 {
            // 423 Locked：真实 CAS 的防爆破/限流保护
            Err(CasError::Locked)
        } else {
            Err(CasError::Protocol(format!(
                "TGT 请求返回非预期状态码: {}",
                status
            )))
        }
    }

    /// 第 2 步：用 TGT 换取 ST
    async fn get_st(&self, tgt: &str) -> Result<String, CasError> {
        let resp = self
            .http
            .post(format!("{}/v1/tickets/{}", self.server_url, tgt))
            .form(&[("service", self.service_url.as_str())])
            .send()
            .await
            .map_err(|e| CasError::Network(e.to_string()))?;

        let status = resp.status();
        if status == reqwest::StatusCode::BAD_REQUEST {
            // 真实 CAS 在 service 未注册时返回 400 + HTML 错误页
            // （"CAS is unable to process this request" / "Application Not Authorized"）
            return Err(CasError::ServiceNotAuthorized);
        }
        if !status.is_success() {
            return Err(CasError::Protocol(format!(
                "ST 请求返回非预期状态码: {}",
                status
            )));
        }

        let st = resp
            .text()
            .await
            .map_err(|e| CasError::Network(e.to_string()))?;
        let st = st.trim();
        if st.is_empty() || !st.starts_with("ST-") {
            return Err(CasError::Protocol(format!(
                "ST 响应内容格式不正确: {:?}",
                st.chars().take(32).collect::<String>()
            )));
        }
        Ok(st.to_string())
    }

    /// 第 3 步：验证 ST，解析 XML 获取用户信息
    async fn validate_st(&self, st: &str) -> Result<CasUser, CasError> {
        let resp = self
            .http
            .get(format!("{}/serviceValidate", self.server_url))
            .query(&[("ticket", st), ("service", self.service_url.as_str())])
            .send()
            .await
            .map_err(|e| CasError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Err(CasError::Protocol(format!(
                "serviceValidate 请求返回非预期状态码: {}",
                resp.status()
            )));
        }

        let body = resp
            .text()
            .await
            .map_err(|e| CasError::Network(e.to_string()))?;
        parse_service_response(&body)
    }
}

/// 从 Location 头中解析 TGT（取路径最后一段）
fn extract_tgt_from_location(location: &str) -> Result<String, CasError> {
    location
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .ok_or_else(|| CasError::Protocol(format!("无法从 Location 头解析 TGT: {}", location)))
}

/// 从旧版 CAS 的 201 HTML 响应体中解析 TGT（取 form action 的最后一段）
fn extract_tgt_from_form_action(body: &str) -> Result<String, CasError> {
    if let Some(pos) = body.find("action=\"") {
        let rest = &body[pos + 8..];
        if let Some(end) = rest.find('"') {
            return extract_tgt_from_location(&rest[..end]);
        }
    }
    Err(CasError::Protocol(
        "TGT 响应缺少 Location 头且无法从 HTML 解析".to_string(),
    ))
}

/// 提取 `<cas:{tag}>...</cas:{tag}>` 标签内容（简单字符串匹配，不引重型 XML 库）
fn extract_cas_tag(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<cas:{}>", tag);
    let close = format!("</cas:{}>", tag);
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find(&close)? + start;
    Some(xml[start..end].trim().to_string())
}

/// 解析 serviceValidate 响应 XML
///
/// CAS 惯例：认证失败也返回 HTTP 200，需根据 XML 内容判断成功/失败
fn parse_service_response(body: &str) -> Result<CasUser, CasError> {
    if body.contains("<cas:authenticationSuccess") {
        let username = extract_cas_tag(body, "user")
            .ok_or_else(|| CasError::Protocol("认证成功响应缺少 <cas:user>".to_string()))?;
        Ok(CasUser {
            username,
            name: extract_cas_tag(body, "name"),
            employee_number: extract_cas_tag(body, "employeeNumber"),
        })
    } else if body.contains("<cas:authenticationFailure") {
        Err(CasError::InvalidCredentials)
    } else {
        Err(CasError::Protocol(
            "无法识别的 serviceValidate 响应".to_string(),
        ))
    }
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const SUCCESS_XML: &str = r#"<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
	<cas:authenticationSuccess>
		<cas:user>zhangsan</cas:user>
		<cas:name>张三</cas:name>
		<cas:employeeNumber>20240001</cas:employeeNumber>
	</cas:authenticationSuccess>
</cas:serviceResponse>"#;

    const FAILURE_XML: &str = r#"<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>
	<cas:authenticationFailure code="INVALID_TICKET">
		ticket 'ST-xxx' not recognized
	</cas:authenticationFailure>
</cas:serviceResponse>"#;

    #[test]
    fn test_parse_success_xml_all_fields() {
        let user = parse_service_response(SUCCESS_XML).unwrap();
        assert_eq!(user.username, "zhangsan");
        assert_eq!(user.name, Some("张三".to_string()));
        assert_eq!(user.employee_number, Some("20240001".to_string()));
    }

    #[test]
    fn test_parse_success_xml_only_user() {
        let xml = r#"<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'><cas:authenticationSuccess><cas:user>lisi</cas:user></cas:authenticationSuccess></cas:serviceResponse>"#;
        let user = parse_service_response(xml).unwrap();
        assert_eq!(user.username, "lisi");
        assert_eq!(user.name, None);
        assert_eq!(user.employee_number, None);
    }

    #[test]
    fn test_parse_failure_xml() {
        let err = parse_service_response(FAILURE_XML).unwrap_err();
        assert!(matches!(err, CasError::InvalidCredentials));
    }

    #[test]
    fn test_parse_unrecognized_xml() {
        let err = parse_service_response("<html>not a cas response</html>").unwrap_err();
        assert!(matches!(err, CasError::Protocol(_)));
    }

    #[test]
    fn test_parse_success_xml_missing_user() {
        let xml = r#"<cas:serviceResponse><cas:authenticationSuccess></cas:authenticationSuccess></cas:serviceResponse>"#;
        let err = parse_service_response(xml).unwrap_err();
        assert!(matches!(err, CasError::Protocol(_)));
    }

    #[test]
    fn test_extract_cas_tag() {
        assert_eq!(
            extract_cas_tag(SUCCESS_XML, "user"),
            Some("zhangsan".to_string())
        );
        assert_eq!(extract_cas_tag(SUCCESS_XML, "nonexist"), None);
    }

    #[test]
    fn test_extract_tgt_from_location() {
        // 完整 URL 形式
        assert_eq!(
            extract_tgt_from_location("https://sso.buaa.edu.cn/v1/tickets/TGT-123-abc").unwrap(),
            "TGT-123-abc"
        );
        // 相对路径形式
        assert_eq!(
            extract_tgt_from_location("/v1/tickets/TGT-456").unwrap(),
            "TGT-456"
        );
        // 尾部带斜杠
        assert_eq!(
            extract_tgt_from_location("https://sso.buaa.edu.cn/v1/tickets/TGT-789/").unwrap(),
            "TGT-789"
        );
        // 无法解析
        assert!(extract_tgt_from_location("").is_err());
        assert!(extract_tgt_from_location("/").is_err());
    }

    #[test]
    fn test_extract_tgt_from_form_action() {
        // 旧版 CAS 的 201 HTML 响应
        let html = r#"<html><body><form action="https://sso.buaa.edu.cn/v1/tickets/TGT-form-123" method="post">x</form></body></html>"#;
        assert_eq!(extract_tgt_from_form_action(html).unwrap(), "TGT-form-123");
        // 无 action 时应报错
        assert!(extract_tgt_from_form_action("<html>no form</html>").is_err());
    }

    #[test]
    fn test_new_trims_trailing_slash() {
        let client = CasClient::new("http://cas.example.com/", "http://app.example.com/cas/");
        assert_eq!(client.server_url, "http://cas.example.com");
        assert_eq!(client.service_url, "http://app.example.com/cas");
    }

    #[test]
    fn test_cas_error_display() {
        assert_eq!(
            CasError::InvalidCredentials.to_string(),
            "统一认证失败：用户名或密码错误"
        );
        assert!(CasError::Network("timeout".to_string())
            .to_string()
            .contains("timeout"));
        assert!(CasError::Protocol("bad".to_string())
            .to_string()
            .contains("bad"));
        assert_eq!(
            CasError::ServiceNotAuthorized.to_string(),
            "应用未授权：service 未在统一认证平台注册"
        );
        assert!(CasError::Locked.to_string().contains("锁定"));
    }
}
