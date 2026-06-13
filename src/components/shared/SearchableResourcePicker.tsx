import { X } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export type Resource = {
  id: string;
  name: string;
};

type SearchableResourcePickerProps = {
  readonly resources: Resource[];
  readonly selectedIds: string[];
  readonly onSelectionChange: (selectedIds: string[]) => void;
};

export function SearchableResourcePicker({
  resources,
  selectedIds,
  onSelectionChange,
}: SearchableResourcePickerProps): JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredResources = useMemo(() => {
    if (searchQuery.trim().length === 0) return resources;
    const lowerQuery = searchQuery.toLowerCase();
    return resources.filter((resource) =>
      resource.name.toLowerCase().includes(lowerQuery),
    );
  }, [resources, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleResource = (resourceId: string, checked: boolean): void => {
    const newIds = new Set(selectedSet);
    if (checked) {
      newIds.add(resourceId);
    } else {
      newIds.delete(resourceId);
    }
    onSelectionChange(Array.from(newIds));
  };

  const removeResource = (resourceId: string): void => {
    const newIds = new Set(selectedSet);
    newIds.delete(resourceId);
    onSelectionChange(Array.from(newIds));
  };

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div>
        <Input
          type="text"
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Selected chips */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const resource = resources.find((r) => r.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {resource?.name ?? id}
                <button
                  onClick={() => removeResource(id)}
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/20"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Searchable list */}
      <div className="space-y-2 rounded-md border p-3">
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No resources available
          </p>
        ) : filteredResources.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No resources match "{searchQuery}"
          </p>
        ) : (
          <ScrollArea className="h-64 pr-4">
            <div className="space-y-2">
              {filteredResources.map((resource) => (
                <label
                  key={resource.id}
                  className="flex items-center gap-2 py-1"
                >
                  <Checkbox
                    checked={selectedSet.has(resource.id)}
                    onCheckedChange={(checked) => {
                      toggleResource(resource.id, checked === true);
                    }}
                  />
                  <span className="text-sm">{resource.name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Selection count */}
      {resources.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} of {resources.length} selected
        </p>
      )}
    </div>
  );
}
