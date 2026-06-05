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
      name, description, slug, industry, status, domain, liveUrl, githubUrl,
      shortDescription, role, teamSize, featured, host, imageBg, videoBg,
      coverImageAlt, techStack, highlights, previewUrl,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    const lenErr = firstError(
      maxLen(name, LIMITS.PROJECT_NAME, "Project name"),
      maxLen(description, LIMITS.PROJECT_DESCRIPTION, "Description"),
      maxLen(slug, LIMITS.PROJECT_SLUG, "Slug"),
      maxLen(industry, LIMITS.PROJECT_INDUSTRY, "Industry"),
      maxLen(shortDescription, LIMITS.PROJECT_SHORT_DESCRIPTION, "Short description"),
      maxLen(role, LIMITS.PROJECT_ROLE, "Role"),
      maxLen(teamSize, LIMITS.PROJECT_TEAM_SIZE, "Team size"),
      maxLen(domain, LIMITS.PROJECT_DOMAIN, "Domain"),
      maxLen(host, LIMITS.PROJECT_HOST, "Host"),
      maxLen(liveUrl, LIMITS.PROJECT_LIVE_URL, "Live URL"),
      maxLen(githubUrl, LIMITS.PROJECT_GITHUB_URL, "GitHub URL"),
      maxLen(imageBg, LIMITS.PROJECT_IMAGE_BG, "Image background"),
      maxLen(videoBg, LIMITS.PROJECT_VIDEO_BG, "Video background"),
      maxLen(coverImageAlt, LIMITS.PROJECT_COVER_IMAGE_ALT, "Cover image alt"),
      maxLen(previewUrl, LIMITS.PROJECT_PREVIEW_URL, "Preview URL"),
    );
    if (lenErr) return NextResponse.json({ error: lenErr }, { status: 400 });

    const project = await prisma.project.create({
      data: {
        id: generateId(),
        tenantId: session.tenantId!,
        adminTenantId: session.tenantId!,
        name,
        description,
        slug: slug || slugify(name),
        industry: industry || null,
        status: status ?? "live",
        domain: domain || null,
        host: host || null,
        liveUrl: liveUrl || null,
        githubUrl: githubUrl || null,
        shortDescription: shortDescription || null,
        role: role || null,
        teamSize: teamSize || null,
        featured: featured === true,
        imageBg: imageBg || null,
        videoBg: videoBg || null,
        coverImageAlt: coverImageAlt || null,
        previewUrl: previewUrl || null,
        techStack: Array.isArray(techStack) ? techStack : [],
        highlights: Array.isArray(highlights) ? highlights : [],
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
