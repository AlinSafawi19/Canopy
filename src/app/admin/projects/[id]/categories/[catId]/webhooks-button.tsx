"use client";

import { useState } from "react";
import { Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { WebhooksSection, WebhookRow } from "./webhooks-section";

interface Props {
  projectId: string;
  categoryId: string;
  initialWebhooks: WebhookRow[];
  total: number;
  page: number;
  limit: number;
  basePath: string;
  extraParams: Record<string, string>;
}

export function WebhooksButton({
  projectId,
  categoryId,
  initialWebhooks,
  total,
  page,
  limit,
  basePath,
  extraParams,
}: Props) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <Webhook size={14} />
        Webhooks{total > 0 ? ` (${total})` : ""}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Webhooks"
        size="xl"
        footer={
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              Add Webhook
            </Button>
            <Pagination
              total={total}
              page={page}
              limit={limit}
              basePath={basePath}
              extraParams={extraParams}
              pageParam="wPage"
              limitParam="wLimit"
              className="py-0"
            />
          </div>
        }
      >
        <WebhooksSection
          projectId={projectId}
          categoryId={categoryId}
          initialWebhooks={initialWebhooks}
          createOpen={createOpen}
          onCreateClose={() => setCreateOpen(false)}
        />
      </Modal>
    </>
  );
}
