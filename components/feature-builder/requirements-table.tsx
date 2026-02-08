"use client"

import { useState, useCallback } from "react"
import { Plus, Trash2, Edit2, Check, X, FileDown, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  type Requirement,
  type RequirementCategory,
  CATEGORY_CONFIG,
  generateReqId,
  exportRequirements,
  parseRequirementsFromText,
} from "./feature-builder-types"

interface RequirementsTableProps {
  requirements: Requirement[]
  featureName: string
  projectId: string
  onChange: (requirements: Requirement[]) => void
  errors?: Record<string, string>
}

interface EditingState {
  id: string | null
  description: string
  category: RequirementCategory
  notes: string
}

export function RequirementsTable({
  requirements,
  featureName,
  projectId,
  onChange,
  errors,
}: RequirementsTableProps) {
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [newRequirement, setNewRequirement] = useState<{
    description: string
    category: RequirementCategory
    notes: string
  }>({
    description: "",
    category: "v1",
    notes: "",
  })
  const [showAiDialog, setShowAiDialog] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const handleAdd = useCallback(() => {
    if (!newRequirement.description.trim()) return

    const req: Requirement = {
      id: generateReqId(requirements),
      description: newRequirement.description.trim(),
      category: newRequirement.category,
      source: "conversation",
      notes: newRequirement.notes.trim() || undefined,
    }

    onChange([...requirements, req])
    setNewRequirement({ description: "", category: "v1", notes: "" })
    setIsAdding(false)
  }, [newRequirement, requirements, onChange])

  const handleEdit = useCallback(
    (id: string) => {
      const req = requirements.find((r) => r.id === id)
      if (!req) return

      setEditing({
        id,
        description: req.description,
        category: req.category,
        notes: req.notes || "",
      })
    },
    [requirements]
  )

  const handleSaveEdit = useCallback(() => {
    if (!editing || !editing.description.trim()) return

    onChange(
      requirements.map((req) =>
        req.id === editing.id
          ? {
              ...req,
              description: editing.description.trim(),
              category: editing.category,
              notes: editing.notes.trim() || undefined,
            }
          : req
      )
    )
    setEditing(null)
  }, [editing, requirements, onChange])

  const handleCancelEdit = useCallback(() => {
    setEditing(null)
  }, [])

  const handleDelete = useCallback(
    (id: string) => {
      onChange(requirements.filter((req) => req.id !== id))
    },
    [requirements, onChange]
  )

  const handleChangeCategory = useCallback(
    (id: string, category: RequirementCategory) => {
      onChange(
        requirements.map((req) =>
          req.id === id ? { ...req, category } : req
        )
      )
    },
    [requirements, onChange]
  )

  const handleExport = useCallback(() => {
    const exportData = exportRequirements({
      name: featureName,
      projectId,
      requirements,
    })

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${featureName.replace(/\s+/g, "_")}_requirements.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [featureName, projectId, requirements])

  const handleAiGenerate = useCallback(() => {
    if (!aiInput.trim()) return

    setIsGenerating(true)

    // Simulate AI processing - in real implementation this would call an API
    setTimeout(() => {
      const parsed = parseRequirementsFromText(aiInput, "research")
      // Re-generate IDs to ensure uniqueness with existing requirements
      const existingIds = new Set(requirements.map((r) => r.id))
      let nextId = 1
      const newReqs = parsed.map((req) => {
        while (existingIds.has(`REQ-${String(nextId).padStart(3, "0")}`)) {
          nextId++
        }
        const id = `REQ-${String(nextId).padStart(3, "0")}`
        existingIds.add(id)
        nextId++
        return { ...req, id }
      })

      onChange([...requirements, ...newReqs])
      setAiInput("")
      setIsGenerating(false)
      setShowAiDialog(false)
    }, 1000)
  }, [aiInput, requirements, onChange])

  const v1Count = requirements.filter((r) => r.category === "v1").length
  const v2Count = requirements.filter((r) => r.category === "v2").length
  const outOfScopeCount = requirements.filter(
    (r) => r.category === "out-of-scope"
  ).length

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success" className="gap-1">
          <span className="font-bold">{v1Count}</span>
          <span className="text-xs opacity-80">V1</span>
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <span className="font-bold">{v2Count}</span>
          <span className="text-xs opacity-80">V2</span>
        </Badge>
        <Badge variant="outline" className="gap-1">
          <span className="font-bold">{outOfScopeCount}</span>
          <span className="text-xs opacity-80">Out of Scope</span>
        </Badge>
        <span className="text-xs text-muted-foreground ml-2">
          {requirements.length} total
        </span>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAiDialog(true)}
          className="gap-1"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Generate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={requirements.length === 0}
          className="gap-1"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Requirements Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-24">ID</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-32">Category</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requirements.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  No requirements yet. Add one below or use AI Generate.
                </TableCell>
              </TableRow>
            ) : (
              requirements.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {req.id}
                  </TableCell>
                  <TableCell>
                    {editing?.id === req.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editing.description}
                          onChange={(e) =>
                            setEditing(prev => prev ? { ...prev, description: e.target.value } : null)
                          }
                          placeholder="Requirement description"
                          className="text-sm"
                        />
                        <Input
                          value={editing.notes}
                          onChange={(e) =>
                            setEditing(prev => prev ? { ...prev, notes: e.target.value } : null)
                          }
                          placeholder="Notes (optional)"
                          className="text-xs"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-sm">{req.description}</div>
                        {req.notes && (
                          <div className="text-xs text-muted-foreground">
                            {req.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editing?.id === req.id && editing ? (
                      <Select
                        value={editing.category}
                        onValueChange={(value) =>
                          setEditing(prev => prev ? { ...prev, category: value as RequirementCategory } : null)
                        }
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="v1">V1 (Must Have)</SelectItem>
                          <SelectItem value="v2">V2 (Should Have)</SelectItem>
                          <SelectItem value="out-of-scope">
                            Out of Scope
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={cn(
                                "cursor-pointer",
                                CATEGORY_CONFIG[req.category].color
                              )}
                              onClick={() => {
                                const categories: RequirementCategory[] = [
                                  "v1",
                                  "v2",
                                  "out-of-scope",
                                ]
                                const currentIndex = categories.indexOf(
                                  req.category
                                )
                                const nextCategory =
                                  categories[
                                    (currentIndex + 1) % categories.length
                                  ]
                                handleChangeCategory(req.id, nextCategory)
                              }}
                            >
                              {CATEGORY_CONFIG[req.category].label.split(" ")[0]}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              {CATEGORY_CONFIG[req.category].description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Click to cycle categories
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editing?.id === req.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={handleSaveEdit}
                          className="h-6 w-6"
                        >
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={handleCancelEdit}
                          className="h-6 w-6"
                        >
                          <X className="h-3.5 w-3.5 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleEdit(req.id)}
                          className="h-6 w-6"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDelete(req.id)}
                          className="h-6 w-6 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Add New Row */}
            {isAdding && (
              <TableRow className="bg-muted/30">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {generateReqId(requirements)}
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <Input
                      value={newRequirement.description}
                      onChange={(e) =>
                        setNewRequirement({
                          ...newRequirement,
                          description: e.target.value,
                        })
                      }
                      placeholder="Enter requirement description..."
                      className="text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleAdd()
                        }
                      }}
                    />
                    <Input
                      value={newRequirement.notes}
                      onChange={(e) =>
                        setNewRequirement({
                          ...newRequirement,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Notes (optional)"
                      className="text-xs"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Select
                    value={newRequirement.category}
                    onValueChange={(value) =>
                      setNewRequirement({
                        ...newRequirement,
                        category: value as RequirementCategory,
                      })
                    }
                  >
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="v1">V1 (Must Have)</SelectItem>
                      <SelectItem value="v2">V2 (Should Have)</SelectItem>
                      <SelectItem value="out-of-scope">Out of Scope</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleAdd}
                      disabled={!newRequirement.description.trim()}
                      className="h-6 w-6"
                    >
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setIsAdding(false)
                        setNewRequirement({
                          description: "",
                          category: "v1",
                          notes: "",
                        })
                      }}
                      className="h-6 w-6"
                    >
                      <X className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Button */}
      {!isAdding && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="w-full gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Requirement
        </Button>
      )}

      {/* Validation Error */}
      {errors?.requirements && (
        <p className="text-sm text-destructive">{errors.requirements}</p>
      )}

      {/* AI Generate Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Generate Requirements
            </DialogTitle>
            <DialogDescription>
              Paste research notes, conversation transcripts, or raw requirements.
              AI will extract and categorize them using GSD methodology.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Input Text</Label>
              <Textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder={`Example:
V1: User can log in with email and password
V1: Password must be at least 8 characters
V2: Support Google OAuth login
Out of scope: Mobile app support`}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Accepted formats:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Category headers: &quot;V1:&quot;, &quot;V2:&quot;, &quot;Out of scope:&quot;</li>
                <li>REQ-IDs: &quot;REQ-001: Description&quot; (auto-generated if missing)</li>
                <li>Plain text: One requirement per line</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAiDialog(false)
                  setAiInput("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAiGenerate}
                disabled={!aiInput.trim() || isGenerating}
                className="gap-1"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
