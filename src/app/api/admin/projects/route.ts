import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateId, slugify } from "@/lib/utils";
import { LIMITS, maxLen } from "@/lib/limits";
import { firstError } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name, overview, slug, industry, status, domain, liveUrl, githubUrl,
      tagline, role, teamSize, featured, host, thumbnail_image, thumbnail_video,
      thumbnail_type, thumbnail_alt, techStack, highlights,
      challenge, approach, outcome, testimonial,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }
    if (!overview?.trim()) {
      return NextResponse.json({ error: "Overview is required." }, { status: 400 });
    }

    const lenErr = firstError(
      maxLen(name, LIMITS.PROJECT_NAME, "Project name"),
      maxLen(overview, LIMITS.PROJECT_OVERVIEW, "Overview"),
      maxLen(slug, LIMITS.PROJECT_SLUG, "Slug"),
      maxLen(industry, LIMITS.PROJECT_INDUSTRY, "Industry"),
      maxLen(tagline, LIMITS.PROJECT_TAGLINE, "Short description"),
      maxLen(role, LIMITS.PROJECT_ROLE, "Role"),
      maxLen(teamSize, LIMITS.PROJECT_TEAM_SIZE, "Team size"),
      maxLen(domain, LIMITS.PROJECT_DOMAIN, "Domain"),
      maxLen(host, LIMITS.PROJECT_HOST, "Host"),
      maxLen(liveUrl, LIMITS.PROJECT_LIVE_URL, "Live URL"),
      maxLen(githubUrl, LIMITS.PROJECT_GITHUB_URL, "GitHub URL"),
      maxLen(thumbnail_image, LIMITS.PROJECT_THUMBNAIL_IMAGE, "Thumbnail image"),
      maxLen(thumbnail_video, LIMITS.PROJECT_THUMBNAIL_VIDEO, "Thumbnail video"),
      maxLen(thumbnail_type, LIMITS.PROJECT_THUMBNAIL_TYPE, "Thumbnail type"),
      maxLen(thumbnail_alt, LIMITS.PROJECT_THUMBNAIL_ALT, "Thumbnail alt"),
      maxLen(challenge, LIMITS.PROJECT_CHALLENGE, "Challenge"),
      maxLen(approach, LIMITS.PROJECT_APPROACH, "Approach"),
      maxLen(outcome, LIMITS.PROJECT_OUTCOME, "Outcome"),
      maxLen(testimonial, LIMITS.PROJECT_TESTIMONIAL, "Testimonial"),
    );
    if (lenErr) return NextResponse.json({ error: lenErr }, { status: 400 });

    const project = await prisma.project.create({
      data: {
        id: generateId(),
        tenantId: session.tenantId!,
        adminTenantId: session.tenantId!,
        name,
        overview,
        slug: slug || slugify(name),
        industry: industry || null,
        status: status ?? "live",
        domain: domain || null,
        host: host || null,
        liveUrl: liveUrl || null,
        githubUrl: githubUrl || null,
        tagline: tagline || null,
        role: role || null,
        teamSize: teamSize || null,
        featured: featured === true,
        thumbnail_image: thumbnail_image || null,
        thumbnail_video: thumbnail_video || null,
        thumbnail_type: thumbnail_type || null,
        thumbnail_alt: thumbnail_alt || null,
        techStack: Array.isArray(techStack) ? techStack : [],
        highlights: Array.isArray(highlights) ? highlights : [],
        challenge: challenge || null,
        approach: approach || null,
        outcome: outcome || null,
        testimonial: testimonial || null,
        categories: [],
        updatedBy: session.id,
      },
    });

    await logActivity({ session, action: "created", resource: "project", resourceId: project.id, resourceName: project.name, adminTenantId: session.tenantId! });

    return NextResponse.json({ id: project.id }, { status: 201 });
  } catch (err) {
    console.error("[admin/projects POST]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
