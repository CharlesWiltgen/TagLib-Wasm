#!/usr/bin/env -S deno run --allow-net --allow-write --allow-env

/**
 * Fetch SonarCloud analysis report for TagLib-Wasm
 *
 * Usage:
 *   deno run --allow-net --allow-write scripts/fetch-sonarcloud-report.ts
 *
 * Set SONAR_TOKEN environment variable for private projects
 */

const SONARCLOUD_API = "https://sonarcloud.io/api";
const PROJECT_KEY = "CharlesWiltgen_taglib-wasm";

interface SonarIssue {
  key: string;
  rule: string;
  severity: string;
  component: string;
  line?: number;
  message: string;
  type: string;
  effort?: string;
  debt?: string;
  tags: string[];
}

interface SonarMeasure {
  metric: string;
  value: string;
  bestValue?: boolean;
}

async function fetchFromSonar(
  endpoint: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`${SONARCLOUD_API}${endpoint}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.append(key, value)
  );

  const headers: HeadersInit = {};
  const token = Deno.env.get("SONAR_TOKEN");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `SonarCloud API error: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

async function fetchAllIssues(): Promise<SonarIssue[]> {
  const issues: SonarIssue[] = [];
  let page = 1;
  const pageSize = 500;

  while (true) {
    console.log(`Fetching issues page ${page}...`);
    const data = await fetchFromSonar("/issues/search", {
      componentKeys: PROJECT_KEY,
      p: page.toString(),
      ps: pageSize.toString(),
      statuses: "OPEN,CONFIRMED,REOPENED",
    });

    issues.push(...data.issues);

    if (data.p * data.ps >= data.total) break;
    page++;
  }

  return issues;
}

async function fetchMetrics(): Promise<Record<string, string>> {
  const metrics = [
    "coverage",
    "code_smells",
    "bugs",
    "vulnerabilities",
    "security_hotspots",
    "duplicated_lines_density",
    "cognitive_complexity",
    "sqale_rating",
    "reliability_rating",
    "security_rating",
    "ncloc",
    "lines",
    "files",
    "functions",
    "classes",
    "comment_lines_density",
  ].join(",");

  const data = await fetchFromSonar("/measures/component", {
    component: PROJECT_KEY,
    metricKeys: metrics,
  });

  const result: Record<string, string> = {};
  data.component.measures.forEach((measure: SonarMeasure) => {
    result[measure.metric] = measure.value;
  });

  return result;
}

async function generateReport() {
  console.log("Fetching SonarCloud report for TagLib-Wasm...\n");

  try {
    // Fetch metrics
    console.log("Fetching project metrics...");
    const metrics = await fetchMetrics();

    // Fetch all issues
    const issues = await fetchAllIssues();

    // Group issues by severity
    const issuesBySeverity = issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group issues by type
    const issuesByType = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group issues by file
    const issuesByFile = issues.reduce((acc, issue) => {
      const file = issue.component.replace(PROJECT_KEY + ":", "");
      if (!acc[file]) acc[file] = [];
      acc[file].push(issue);
      return acc;
    }, {} as Record<string, SonarIssue[]>);

    // Generate markdown report
    let report = "# SonarCloud Analysis Report\n\n";
    report += `**Project:** TagLib-Wasm\n`;
    report += `**Date:** ${new Date().toISOString()}\n\n`;

    report += "## Overview\n\n";
    report += "### Quality Gate Status\n\n";
    report += `- **Code Coverage:** ${metrics.coverage || "N/A"}%\n`;
    report += `- **Bugs:** ${metrics.bugs || 0}\n`;
    report += `- **Vulnerabilities:** ${metrics.vulnerabilities || 0}\n`;
    report += `- **Security Hotspots:** ${metrics.security_hotspots || 0}\n`;
    report += `- **Code Smells:** ${metrics.code_smells || 0}\n`;
    report += `- **Duplication:** ${metrics.duplicated_lines_density || 0}%\n`;
    report += `- **Lines of Code:** ${metrics.ncloc || 0}\n\n`;

    report += "### Ratings\n\n";
    report += `- **Maintainability:** ${getRating(metrics.sqale_rating)}\n`;
    report += `- **Reliability:** ${getRating(metrics.reliability_rating)}\n`;
    report += `- **Security:** ${getRating(metrics.security_rating)}\n\n`;

    report += `## Issues Summary (${issues.length} total)\n\n`;

    report += "### By Severity\n\n";
    Object.entries(issuesBySeverity)
      .sort(([a], [b]) => getSeverityWeight(b) - getSeverityWeight(a))
      .forEach(([severity, count]) => {
        report += `- **${severity}:** ${count}\n`;
      });

    report += "\n### By Type\n\n";
    Object.entries(issuesByType)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        report += `- **${type}:** ${count}\n`;
      });

    report += "\n## Issues by File\n\n";

    // Sort files by issue count
    const sortedFiles = Object.entries(issuesByFile)
      .sort(([, a], [, b]) => b.length - a.length);

    for (const [file, fileIssues] of sortedFiles) {
      report += `### ${file} (${fileIssues.length} issues)\n\n`;

      // Sort issues by severity and line number
      const sortedIssues = fileIssues.sort((a, b) => {
        const severityDiff = getSeverityWeight(b.severity) -
          getSeverityWeight(a.severity);
        if (severityDiff !== 0) return severityDiff;
        return (a.line || 0) - (b.line || 0);
      });

      for (const issue of sortedIssues) {
        const line = issue.line ? `L${issue.line}` : "File-level";
        const severity = issue.severity.toUpperCase();
        report += `- **[${severity}]** ${line}: ${issue.message}\n`;
        report += `  - Rule: \`${issue.rule}\`\n`;
        if (issue.effort) report += `  - Effort: ${issue.effort}\n`;
        report += "\n";
      }
    }

    // Save report
    const filename = `sonarcloud-report-${
      new Date().toISOString().split("T")[0]
    }.md`;
    await Deno.writeTextFile(filename, report);
    console.log(`\n✅ Report saved to: ${filename}`);

    // Also save raw JSON data
    const jsonFilename = `sonarcloud-report-${
      new Date().toISOString().split("T")[0]
    }.json`;
    await Deno.writeTextFile(
      jsonFilename,
      JSON.stringify({ metrics, issues }, null, 2),
    );
    console.log(`✅ Raw data saved to: ${jsonFilename}`);
  } catch (error) {
    console.error("❌ Error fetching SonarCloud report:", error);
    console.error(
      "\nIf this is a private project, set SONAR_TOKEN environment variable",
    );
    Deno.exit(1);
  }
}

function getRating(value?: string): string {
  if (!value) return "N/A";
  const ratings = ["", "A", "B", "C", "D", "E"];
  return ratings[parseInt(value)] || value;
}

function getSeverityWeight(severity: string): number {
  const weights: Record<string, number> = {
    BLOCKER: 5,
    CRITICAL: 4,
    MAJOR: 3,
    MINOR: 2,
    INFO: 1,
  };
  return weights[severity] || 0;
}

if (import.meta.main) {
  await generateReport();
}
