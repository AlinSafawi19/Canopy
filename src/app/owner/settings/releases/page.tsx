import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PublishReleaseButton } from "./publish-release-button";
import { Megaphone } from "lucide-react";

export default async function ReleasesPage() {
  const releases = await prisma.release.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Releases</CardTitle>
        <PublishReleaseButton />
      </CardHeader>
      <CardContent className="p-0">
        {releases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Megaphone size={18} className="text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No releases yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Publish a release to notify all users and show them what&rsquo;s new.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {releases.map((release) => (
              <li key={release.id} className="px-4 sm:px-6 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="inline-flex items-center bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
                      {release.version}
                    </span>
                    <span className="text-sm font-medium text-slate-900 truncate">{release.title}</span>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {new Date(release.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 pl-0">
                  {release.notes}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
