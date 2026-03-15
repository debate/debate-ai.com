import { NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";

const ISSUES_DIR = join(process.cwd(), "data", "video-issues");
const ISSUES_FILE = join(ISSUES_DIR, "issues.json");

interface VideoIssue {
  videoId: string;
  title: string;
  issue: string;
  timestamp: string;
}

async function ensureIssuesFile() {
  try {
    await mkdir(ISSUES_DIR, { recursive: true });
    try {
      await readFile(ISSUES_FILE, "utf-8");
    } catch {
      await writeFile(ISSUES_FILE, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error("Failed to ensure issues file:", error);
  }
}

export async function POST(request: Request) {
  try {
    const body: VideoIssue = await request.json();

    if (!body.videoId || !body.issue || !body.timestamp) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await ensureIssuesFile();

    // Read existing issues
    let issues: VideoIssue[] = [];
    try {
      const data = await readFile(ISSUES_FILE, "utf-8");
      issues = JSON.parse(data);
    } catch {
      issues = [];
    }

    // Add new issue
    issues.push({
      videoId: body.videoId,
      title: body.title || "Unknown",
      issue: body.issue,
      timestamp: body.timestamp,
    });

    // Write back to file
    await writeFile(ISSUES_FILE, JSON.stringify(issues, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save video issue:", error);
    return NextResponse.json(
      { error: "Failed to save issue" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await ensureIssuesFile();
    const data = await readFile(ISSUES_FILE, "utf-8");
    const issues = JSON.parse(data);
    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Failed to read video issues:", error);
    return NextResponse.json({ issues: [] });
  }
}
