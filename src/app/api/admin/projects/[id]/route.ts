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
        name, overview, slug, status, domain, host, liveUrl, githubUrl,
        tagline, industry, featured, role, teamSize,
        thumbnail_image, thumbnail_video, thumbnail_type, thumbnail_alt, techStack, highlights,
        challenge, approach, outcome, testimonial,
        startDate, endDate,
      } = body;
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
      await prisma.project.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(overview !== undefined && { overview }),
          ...(slug !== undefined && { slug }),
          ...(status && { status }),
          ...(domain !== undefined && { domain }),
          ...(host !== undefined && { host }),
          ...(liveUrl !== undefined && { liveUrl }),
          ...(githubUrl !== undefined && { githubUrl }),
          ...(tagline !== undefined && { tagline }),
          ...(industry !== undefined && { industry }),
          ...(featured !== undefined && { featured }),
          ...(role !== undefined && { role }),
          ...(teamSize !== undefined && { teamSize }),
          ...(thumbnail_image !== undefined && { thumbnail_image }),
          ...(thumbnail_video !== undefined && { thumbnail_video }),
          ...(thumbnail_type !== undefined && { thumbnail_type }),
          ...(thumbnail_alt !== undefined && { thumbnail_alt }),
          ...(techStack !== undefined && { techStack }),
          ...(highlights !== undefined && { highlights }),
          ...(challenge !== undefined && { challenge }),
          ...(approach !== undefined && { approach }),
          ...(outcome !== undefined && { outcome }),
          ...(testimonial !== undefined && { testimonial }),
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
