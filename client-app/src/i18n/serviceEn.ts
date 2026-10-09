/**
 * 服务端业务数据（服务名称/描述/使用说明）的英文映射。
 * 这些数据存储在服务端数据库且为单语中文，客户端按服务 UUID（注册后不变）
 * 在英文界面下替换显示；未命中映射时一律回退为服务端原文。
 * 注意：仅影响展示层，提交给服务端的原始数据保持不变。
 */
import { i18n } from '@/i18n'

interface ServiceEnText {
  name?: string
  description?: string
  usage?: string
}

const SERVICE_EN: Record<string, ServiceEnText> = {
  // IDM-Alpha材料科学文献研究助手
  '4dce11ed-4457-477a-982f-7c91794e336b': {
    name: 'IDM-Alpha Materials Science Literature Assistant',
    description:
      'A literature analysis service for materials science. It answers materials science questions and, on explicit request, generates in-depth paper reading reports. Suitable for literature Q&A, paper interpretation, and cross-paper reviews in areas such as metallic, ceramic, and composite materials.',
    usage: `This service supports the following usage modes:

  - Mode 1 · General Q&A: Ask a materials science question directly and get an answer grounded in the literature.
  - Mode 2 · One-step deep report: Explicitly request a "deep report", "close-reading report", "HTML report", etc. within a single question.
  - Mode 3 · Two-stage deep report: Run a general Q&A task first; then upload the resulting query_result.json and response.md as input_files and request the deep reading report.

  Examples:

  Mode 1 (General Q&A):

  task_prompt:|
  Explain the oxidation resistance mechanism of high-entropy alloys

  output_prompt:|

  —

  Mode 2 (One-step deep report):

  task_prompt:|
  Why is BaTiO3 ceramic ferroelectric? Please generate a deep reading report

  output_prompt:|

  —

  Mode 3 (Two-stage deep report):

  First task:

  task_prompt:|
  How does fatigue damage typically evolve in glass-fiber-reinforced epoxy?

  output_prompt:|

  Then a second task:

  task_prompt:|
  Based on the uploaded retrieval results and answer file, interpret each relevant paper in detail and compile a deep reading report

  input_files:|

  - /path/to/query_result.json
  - /path/to/response.md

  output_prompt:|`,
  },

  // 扶摇多专家研讨系统
  '4eda1302-1a8a-41b2-89ba-0568ae70c8fb': {
    name: 'Fuyao Multi-Expert Deliberation System',
    description:
      'An AI multi-expert panel system for deep questions. It breaks problems down from multiple perspectives, collides viewpoints, and produces an in-depth deliberated conclusion.',
    usage: `Usage

The multi-expert panel system runs multi-stage, multi-round discussions to produce a deliberated conclusion. The process is slow — expect at least 1 hour — so please be patient. When submitting a task, it is recommended to provide the expert panel setup to better focus the discussion. If no expert setup is provided, the system assigns experts automatically based on the topic.

Example:

task_prompt:
Topic: "Composition design of refractory high-entropy alloys for aero-engine turbine blade applications: how to synergistically optimize high-temperature strength and oxidation resistance above 1350°C?"
Background: Aero-engine turbine blades are among the most demanding applications in materials science. Commercial nickel-based single-crystal superalloys (e.g. CMSX-4, RR3010) top out at about 1100°C (metal temperature), roughly 0.85 of their melting point. To raise thrust-to-weight ratio and fuel efficiency, next-generation turbine blades must withstand metal temperatures above 1350°C.
Refractory high-entropy alloys (RHEAs, e.g. Mo-Nb-Ta-W based systems) theoretically offer far greater high-temperature strength than nickel-based alloys thanks to their refractory elements. However, these refractory elements (W, Mo, Ta, Nb) form volatile oxides (such as WO3, MoO3) in oxidizing environments at 1350°C, causing catastrophic oxidation. There is therefore a fundamental scientific conflict between "high-temperature strength" and "oxidation resistance".

Current mainstream research directions include:

- Introducing Al, Cr, Si into the refractory matrix, hoping to form protective Al2O3 or Cr2O3 oxide scales
- Relying on external thermal barrier coatings (TBC) + oxidation-resistant coating systems, without requiring the matrix itself to resist oxidation
- Exploring low-density alternatives (e.g. Nb-Si based, Mo-Si-B based) or ceramic-matrix composites

[Expert Panel] 6 experts

Expert 1: Phase diagrams & thermodynamics
Role: Senior computational thermodynamics researcher
Expertise: CALPHAD calculations, phase diagram thermodynamics, phase stability prediction
Core bias: Thermodynamic stability is the foundation of all design; anything violating thermodynamics is impossible
Challenges: Questions any composition not validated thermodynamically; demands ΔG and phase diagram evidence
Won't compromise: Firmly rejects a composition if thermodynamic calculations show the target phase is unstable at the target temperature
Typical remark: "Phase diagrams don't lie. Your single-phase solid solution is thermodynamically unstable at 1350°C — tell me how you'd make it work?"

Expert 2: Composition design
Role: HEA composition design researcher
Expertise: HEA composition–process–property relationships, solid-solution strengthening, lattice distortion theory
Core bias: Composition decides everything; experience beats pure calculation; moderate Al/Cr/Si additions are the only route to oxidation resistance
Challenges: Questions the thermodynamics expert's over-reliance on ideal models, ignoring the metastable design space opened by non-equilibrium processing
Won't compromise: Firmly opposes RHEA schemes that entirely exclude Al/Cr, as that means giving up oxidation resistance
Typical remark: "Pure Mo-Nb-Ta-W oxidizes through in seconds at 1350°C — what good is strength then? We must introduce Al/Cr to form a protective scale."

Expert 3: Mechanical properties
Role: High-temperature mechanical testing specialist
Expertise: High-temperature creep, tensile properties, fatigue life, fracture mechanics
Core bias: Claims without high-temperature mechanical data are just stories; creep life at 1350°C is the hard metric
Challenges: Demands measured creep/tensile data at 1350°C or reliable extrapolation for every composition
Won't compromise: Questions engineering viability if predicted creep life at 1350°C / 100 MPa is < 100h
Typical remark: "Room-temperature hardness of three samples proves nothing. Where are the 1350°C creep curves? Error bars? Statistical significance?"

Expert 4: Oxidation & corrosion
Role: High-temperature oxidation and protective coating specialist
Expertise: High-temperature oxidation kinetics, scale formation mechanisms, TBC / oxidation-resistant coatings
Core bias: Oxidation resistance is the lifeline of high-temperature applications; without a protective scale, the strongest matrix is worthless
Challenges: Questions any composition without assessed isothermal/cyclic oxidation behavior at 1350°C
Won't compromise: Firmly rejects alloys with oxidation weight gain > 10mg/cm²·h at 1350°C or catastrophic oxidation
Typical remark: "W and Mo form volatile WO3/MoO3 at 1350°C. Oxidation resistance isn't achieved by wishful thinking."

Expert 5: Processing & manufacturing
Role: Refractory alloy melting and processing specialist
Expertise: Vacuum arc melting, directional solidification, powder metallurgy, additive manufacturing
Core bias: No matter how pretty the lab calculations, if it can't be made it's just talk; industrial furnaces and laboratories are two different things
Challenges: Questions whether the design accounts for actual melting segregation, melting-point gaps, and formability
Won't compromise: Questions industrial manufacturability if main-element melting points differ by > 1000°C or volatile elements are present
Typical remark: "Ta and W differ by 400°C in melting point — in vacuum arc melting W solidifies first and Ta last. Can you control the segregation?"

Expert 6: Engineering & cost
Role: Aviation materials engineering and cost assessment specialist
Expertise: Aero-engine material selection, supply chain, airworthiness certification, life-cycle cost
Core bias: Lab results don't equal industrial value; aviation materials must account for cost, supply chain, and certification timelines
Challenges: Questions any scheme ignoring density, raw-material supply, processing cost, or certification timeline
Won't compromise: Questions aviation engineering feasibility if alloy density > 15g/cm³ or key raw materials are monopolized by a single country
Typical remark: "This alloy is twice the density of nickel-based single crystal — did you compute the rotor centrifugal forces? Airworthiness certification takes 10 years; can you wait?"

output_prompt:
Summarize the panel conclusion into response.md`,
  },

  // 六元高熵合金描述符数据库
  '8c5c439e-f406-4935-9aa2-61c628751497': {
    name: 'Six-Component High-Entropy Alloy Descriptor Database',
    description:
      'A near-data Agent that queries full-composition descriptor data for six-component high-entropy alloys. The dataset totals 50 billion records and over 10 trillion data points — mostly six-component HEA descriptors, with a small amount of ML-predicted compressive plasticity data; no real experimental data is included.',
    usage: `This database is a computational dataset for 6-component high-entropy alloy (HEA) systems built from 15 metallic elements, covering:

- All 6-element combinations: C(15,6) = 5,005 element combinations
- Full composition space: each element combination covers 5%–35% per element in 1% steps
- 194-dimensional material descriptors: each composition maps to a set of physical/chemical descriptors for machine-learning modeling and alloy design

Examples:

task_prompt:
Which elements are included in the database?

output_prompt:
Write the result to response.md

—

task_prompt:
For the Cr-Al-Mo-Nb-V-Ti alloy system, what are the 10 compositions with the highest cohesive energy?

output_prompt:
Write the results to response.md and a CSV file`,
  },
}

function isEnglish(): boolean {
  return i18n.global.locale.value === 'en-US'
}

/** 服务名称：英文环境且命中映射时返回英文，否则返回服务端原文 */
export function localizedServiceName(serviceId: string, fallback: string): string {
  if (!isEnglish()) return fallback
  return SERVICE_EN[serviceId]?.name ?? fallback
}

/** 服务描述：同上 */
export function localizedServiceDescription(serviceId: string, fallback: string): string {
  if (!isEnglish()) return fallback
  return SERVICE_EN[serviceId]?.description ?? fallback
}

/** 服务使用说明：同上（用于 Markdown 渲染前替换原文） */
export function localizedServiceUsage(serviceId: string, fallback: string): string {
  if (!isEnglish()) return fallback
  return SERVICE_EN[serviceId]?.usage ?? fallback
}
