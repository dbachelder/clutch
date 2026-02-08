"use client"

import { useEffect, useState, use } from "react"
import { useSearchParams } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Board } from "@/components/board/board"
import { CreateTaskModal } from "@/components/board/create-task-modal"
import { FeatureBuilderModal } from "@/components/board/feature-builder-modal"
import { TaskModal } from "@/components/board/task-modal"
import { Button } from "@/components/ui/button"
import type { Task, TaskStatus, Project } from "@/lib/types"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default function BoardPage({ params }: PageProps) {
  const { slug } = use(params)
  const searchParams = useSearchParams()
  const taskIdFromUrl = searchParams.get("task")
  
  const [project, setProject] = useState<Project | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createModalStatus, setCreateModalStatus] = useState<TaskStatus>("backlog")
  const [featureBuilderOpen, setFeatureBuilderOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  useEffect(() => {
    async function fetchProject() {
      const response = await fetch(`/api/projects/${slug}`)
      if (response.ok) {
        const data = await response.json()
        setProject(data.project)
      }
    }
    fetchProject()
  }, [slug])

  // Handle task ID from URL query parameter
  useEffect(() => {
    async function openTaskFromUrl() {
      if (!taskIdFromUrl || !project) return
      
      try {
        const response = await fetch(`/api/tasks/${taskIdFromUrl}`)
        if (response.ok) {
          const data = await response.json()
          setSelectedTask(data.task)
          setTaskModalOpen(true)
        }
      } catch (error) {
        console.error("Failed to fetch task from URL:", error)
      }
    }
    openTaskFromUrl()
  }, [taskIdFromUrl, project])

  const handleAddTask = (status: TaskStatus) => {
    setCreateModalStatus(status)
    setCreateModalOpen(true)
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setTaskModalOpen(true)
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    )
  }

  const handleTasksCreated = (count: number) => {
    console.log(`Created ${count} tasks via Feature Builder`)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Feature Builder button */}
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setFeatureBuilderOpen(true)}
          variant="outline"
          className="flex items-center gap-2 border-[var(--accent-blue)]/30 hover:border-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10"
        >
          <Sparkles className="h-4 w-4 text-[var(--accent-blue)]" />
          Feature Builder
        </Button>
      </div>

      <Board
        projectId={project.id}
        projectSlug={slug}
        onTaskClick={handleTaskClick}
        onAddTask={handleAddTask}
      />
      
      <CreateTaskModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={project.id}
        initialStatus={createModalStatus}
      />

      <FeatureBuilderModal
        projectId={project.id}
        open={featureBuilderOpen}
        onOpenChange={setFeatureBuilderOpen}
        onTasksCreated={handleTasksCreated}
      />
      
      <TaskModal
        task={selectedTask}
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
      />
    </div>
  )
}
