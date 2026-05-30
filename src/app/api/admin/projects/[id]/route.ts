import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIMITS, maxLen } from "@/lib/limits";
import { firstError } from "@/lib/validation";
import { logActivity } from "@/lib/activity-log";

async function getOwnedProject(projectId: string, tenantId: string) {
  return prisma.project.findFirst({ where: { id: projectId, adminTenantId: tenantId } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getOwnedProject(id, session.tenantId!);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  try {
    if (body.action === "archive") {
      await prisma.project.update({ where: { id }, data: { archivedAt: new Date(), archivedBy: session.id } });
      await logActivity({ session, action: "archived", resource: "project", resourceId: id, resourceName: project.name, adminTenantId: session.tenantId! });
    } else if (body.action === "restore") {
      await prisma.project.update({ where: { id }, data: { archivedAt: null, archivedBy: null } });
      await logActivity({ session, action: "restored", resource: "project", resourceId: id, resourceName: project.name, adminTenantId: session.tenantId! });
    } else {
      const {
        name, description, slug, status, domain, host, liveUrl, githubUrl,
        shortDescription, industry, featured, role, teamSize,
        imageBg, videoBg, coverImageAlt, techStack, highlights,
        startDate, endDate,
      } = body;
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
      );
      if (lenErr) return NextResponse.json({ error: lenErr }, { status: 400 });
      await prisma.project.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(slug !== undefined && { slug }),
          ...(status && { status }),
          ...(domain !== undefined && { domain }),
          ...(host !== undefined && { host }),
          ...(liveUrl !== undefined && { liveUrl }),
          ...(githubUrl !== undefined && { githubUrl }),
          ...(shortDescription !== undefined && { shortDescription }),
          ...(industry !== undefined && { industry }),
          ...(featured !== undefined && { featured }),
          ...(role !== undefined && { role }),
          ...(teamSize !== undefined && { teamSize }),
          ...(imageBg !== undefined && { imageBg }),
          ...(videoBg !== undefined && { videoBg }),
          ...(coverImageAlt !== undefined && { coverImageAlt }),
          ...(techStack !== undefined && { techStack }),
          ...(highlights !== undefined && { highlights }),
          ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
          ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
          updatedBy: session.id,
        },
      });
      await logActivity({ session, action: "updated", resource: "project", resourceId: id, resourceName: project.name, adminTenantId: session.tenantId! });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/projects/:id PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const project = await getOwnedProject(id, session.tenantId!);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    // Remove the client's assignment to this project (client itself is kept)
    prisma.clientAssignment.deleteMany({ where: { projectId: id } }),
    // Remove all contributor assignments for this project (contributors themselves are kept)
    prisma.contributorAssignment.deleteMany({ where: { projectId: id } }),
    // Delete the project — ContentCategory → ContentCategoryEntry cascade via DB FK
    prisma.project.delete({ where: { id } }),
  ]);
  await logActivity({ session, action: "deleted", resource: "project", resourceId: id, resourceName: project.name, adminTenantId: session.tenantId! });
  return NextResponse.json({ ok: true });
}
