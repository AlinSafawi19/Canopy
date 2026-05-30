import { ApiIntegrationDocs } from "@/components/api-integration-docs";
import { ApiDocsToc } from "@/components/api-docs-toc";

export default function AdminApiIntegrationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">API Integration</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Documentation for integrating your CMS content into external applications
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-6 md:gap-10 md:items-start">
        <div className="flex-1 min-w-0 order-2 md:order-1">
          <ApiIntegrationDocs />
        </div>
        <div className="w-full md:w-48 md:flex-shrink-0 order-1 md:order-2 md:sticky md:top-20 md:self-start">
          <ApiDocsToc />
        </div>
      </div>
    </div>
  );
}
