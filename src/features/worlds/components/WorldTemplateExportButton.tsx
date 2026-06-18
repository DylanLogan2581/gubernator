import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  exportWorldTemplateMutationOptions,
  serializeWorldTemplate,
} from "../queries/worldTemplateExportQueries";

import type { JSX } from "react";

export function WorldTemplateExportButton({
  worldId,
  worldName,
}: {
  readonly worldId: string;
  readonly worldName: string;
}): JSX.Element {
  const exportMutation = useMutation({
    ...exportWorldTemplateMutationOptions(worldId),
    onSuccess: (template) => {
      // Build filename from template meta slug
      const filename = `${template.meta.slug}.json`;
      const blob = new Blob([serializeWorldTemplate(template)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      toast.success("Template exported", {
        description: `Saved as ${filename}`,
      });
    },
    onError: () => {
      toast.error("Export failed", {
        description: "Could not export world template. Check your permissions.",
      });
    },
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={exportMutation.isPending}
      onClick={() => exportMutation.mutate()}
      aria-label={`Export ${worldName} configuration as JSON template`}
    >
      <Download aria-hidden="true" />
      {exportMutation.isPending ? "Exporting…" : "Export template"}
    </Button>
  );
}
