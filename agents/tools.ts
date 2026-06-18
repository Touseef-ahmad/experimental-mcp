import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================================
// Employee Tools
// ============================================================

const EMPLOYEES = [
  { id: "e-100", name: "Ava", team: "Platform", manager: "Sam" },
  { id: "e-101", name: "Noah", team: "Data", manager: "Lee" },
  { id: "e-102", name: "Mia", team: "Product", manager: "Zoe" },
  { id: "e-103", name: "Liam", team: "Security", manager: "Tia" },
];

export const listEmployees = tool(
  async () => {
    return JSON.stringify(EMPLOYEES);
  },
  {
    name: "list_employees",
    description:
      "Lists all employees in the organization with their team and manager info.",
    schema: z.object({}),
  },
);

export const findEmployeeByName = tool(
  async ({ name }) => {
    const employee = EMPLOYEES.find(
      (e) => e.name.toLowerCase() === name.toLowerCase(),
    );
    return employee
      ? JSON.stringify(employee)
      : `No employee found with name: ${name}`;
  },
  {
    name: "find_employee_by_name",
    description: "Finds an employee by their exact name.",
    schema: z.object({
      name: z.string().describe("The employee name to search for"),
    }),
  },
);

// ============================================================
// Analytics Tools
// ============================================================

export const getEngagementScore = tool(
  async ({ teamOrEmployee }) => {
    let score = 0;
    for (const char of teamOrEmployee) {
      score += char.charCodeAt(0);
    }
    const finalScore = 40 + (score % 61);
    return `Engagement score for "${teamOrEmployee}": ${finalScore}/100`;
  },
  {
    name: "get_engagement_score",
    description: "Calculates the engagement score for a team or employee.",
    schema: z.object({
      teamOrEmployee: z.string().describe("Name of the team or employee"),
    }),
  },
);

export const getTrendSummary = tool(
  async ({ topic }) => {
    const trends = ["upward", "stable", "slightly down"];
    const index = topic.length % trends.length;
    return `Trend for "${topic}": ${trends[index]} this week`;
  },
  {
    name: "get_trend_summary",
    description: "Gets the trend summary for a given topic or metric.",
    schema: z.object({
      topic: z.string().describe("The topic or metric to analyze"),
    }),
  },
);

export const getProjectHealth = tool(
  async ({ projectName }) => {
    const statuses = ["green", "amber", "red"];
    const index = projectName.length % 3;
    return `Project "${projectName}" health status: ${statuses[index]}`;
  },
  {
    name: "get_project_health",
    description: "Gets the health status of a project.",
    schema: z.object({
      projectName: z.string().describe("Name of the project"),
    }),
  },
);

export const getCurrentTimestamp = tool(
  async () => {
    return `Current timestamp: ${new Date().toISOString()}`;
  },
  {
    name: "get_current_timestamp",
    description: "Gets the current UTC timestamp.",
    schema: z.object({}),
  },
);

// ============================================================
// Reporting Tools
// ============================================================

export const buildReport = tool(
  async ({ title, keyPoints }) => {
    const report = {
      title,
      summary: `Report generated from ${keyPoints.length} key point(s).`,
      keyPoints,
      riskLevel: keyPoints.length > 3 ? "medium" : "low",
      generatedAt: new Date().toISOString(),
    };
    return JSON.stringify(report);
  },
  {
    name: "build_report",
    description: "Builds a structured report with title and key points.",
    schema: z.object({
      title: z.string().describe("The report title"),
      keyPoints: z.array(z.string()).describe("Array of key points to include"),
    }),
  },
);

// ============================================================
// Approval Tools
// ============================================================

export const requestApproval = tool(
  async ({ context, riskLevel }) => {
    const autoApprove = riskLevel === "low";
    const decision = {
      status: autoApprove ? "approved" : "pending_review",
      reviewer: autoApprove ? "auto-approver" : "human-reviewer",
      reason: autoApprove
        ? "Low risk - automatically approved"
        : "Requires human review due to risk level",
      context,
      riskLevel,
    };
    return JSON.stringify(decision);
  },
  {
    name: "request_approval",
    description:
      "Requests approval for an action based on context and risk level.",
    schema: z.object({
      context: z.string().describe("Description of what needs approval"),
      riskLevel: z
        .enum(["low", "medium", "high"])
        .describe("Risk level of the action"),
    }),
  },
);

// ============================================================
// Tool Collections
// ============================================================

export const employeeTools = [listEmployees, findEmployeeByName];
export const analyticsTools = [
  getEngagementScore,
  getTrendSummary,
  getProjectHealth,
  getCurrentTimestamp,
];
export const reportingTools = [buildReport];
export const approvalTools = [requestApproval];

export const allTools = [
  ...employeeTools,
  ...analyticsTools,
  ...reportingTools,
  ...approvalTools,
];
