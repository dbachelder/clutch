#!/bin/bash
# cleanup-stale-branches.sh
# Removes stale worktrees and branches for done tasks in Clutch

set -euo pipefail

REPO_PATH="/home/dan/src/clutch"
WORKTREES_PATH="/home/dan/src/clutch-worktrees"
PROJECT_ID="da46e964-a6d1-498a-85a8-c4795e980657"
DRY_RUN=${DRY_RUN:-false}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fetch done task branches from Clutch
fetch_done_branches() {
    log "Fetching done tasks from Clutch API..."
    
    local temp_file=$(mktemp)
    local page=0
    local has_more=true
    
    while [ "$has_more" = true ]; do
        local cursor=""
        if [ $page -gt 0 ]; then
            cursor="&cursor=$(cat $temp_file.cursor 2>/dev/null || echo '')"
        fi
        
        local response=$(curl -s "http://localhost:3002/api/tasks?projectId=$PROJECT_ID&status=done&limit=100$cursor" 2>/dev/null || echo '{"tasks":[]}')
        
        # Extract branches
        echo "$response" | jq -r '.tasks[] | select(.branch != null) | .branch' 2>/dev/null >> "$temp_file" || true
        
        # Check for more
        local next_cursor=$(echo "$response" | jq -r '.nextCursor // empty' 2>/dev/null)
        if [ -z "$next_cursor" ] || [ "$next_cursor" = "null" ]; then
            has_more=false
        else
            echo "$next_cursor" > "$temp_file.cursor"
            ((page++)) || true
        fi
        
        # Safety limit
        if [ $page -gt 10 ]; then
            warn "Reached page limit, stopping pagination"
            has_more=false
        fi
    done
    
    # Remove cursor temp file
    rm -f "$temp_file.cursor" 2>/dev/null || true
    
    sort -u "$temp_file"
    rm -f "$temp_file"
}

# Fetch active (in_progress, in_review) task branches
fetch_active_branches() {
    log "Fetching active tasks from Clutch API..."
    
    local temp_file=$(mktemp)
    
    # In progress
    curl -s "http://localhost:3002/api/tasks?projectId=$PROJECT_ID&status=in_progress&limit=100" 2>/dev/null | \
        jq -r '.tasks[] | select(.branch != null) | .branch' 2>/dev/null >> "$temp_file" || true
    
    # In review
    curl -s "http://localhost:3002/api/tasks?projectId=$PROJECT_ID&status=in_review&limit=100" 2>/dev/null | \
        jq -r '.tasks[] | select(.branch != null) | .branch' 2>/dev/null >> "$temp_file" || true
    
    # Ready (next up)
    curl -s "http://localhost:3002/api/tasks?projectId=$PROJECT_ID&status=ready&limit=100" 2>/dev/null | \
        jq -r '.tasks[] | select(.branch != null) | .branch' 2>/dev/null >> "$temp_file" || true
    
    sort -u "$temp_file"
    rm -f "$temp_file"
}

# Check if worktree has uncommitted changes
has_uncommitted_changes() {
    local worktree_path="$1"
    if [ -d "$worktree_path" ]; then
        local status=$(git -C "$worktree_path" status --porcelain 2>/dev/null || echo "dirty")
        [ -n "$status" ]
    else
        false
    fi
}

# Remove worktree for a branch
remove_worktree() {
    local branch="$1"
    local worktree_path="$WORKTREES_PATH/fix/${branch#fix/}"
    
    if [ ! -d "$worktree_path" ]; then
        # Try alternative paths
        worktree_path=$(git -C "$REPO_PATH" worktree list | grep "\[$branch\]$" | awk '{print $1}' || true)
        if [ -z "$worktree_path" ]; then
            warn "Worktree for $branch not found"
            return
        fi
    fi
    
    # Check for uncommitted changes
    if has_uncommitted_changes "$worktree_path"; then
        warn "Worktree $worktree_path has uncommitted changes, skipping"
        return
    fi
    
    if [ "$DRY_RUN" = true ]; then
        log "[DRY RUN] Would remove worktree: $worktree_path"
    else
        log "Removing worktree: $worktree_path"
        git -C "$REPO_PATH" worktree remove "$worktree_path" --force 2>/dev/null || \
            warn "Failed to remove worktree $worktree_path"
    fi
}

# Delete local branch
delete_local_branch() {
    local branch="$1"
    
    if [ "$DRY_RUN" = true ]; then
        log "[DRY RUN] Would delete local branch: $branch"
    else
        log "Deleting local branch: $branch"
        git -C "$REPO_PATH" branch -D "$branch" 2>/dev/null || \
            warn "Failed to delete branch $branch"
    fi
}

# Delete remote branch
delete_remote_branch() {
    local branch="$1"
    
    # Check if branch exists on remote
    if git -C "$REPO_PATH" ls-remote --heads origin "$branch" 2>/dev/null | grep -q "$branch"; then
        if [ "$DRY_RUN" = true ]; then
            log "[DRY RUN] Would delete remote branch: origin/$branch"
        else
            log "Deleting remote branch: origin/$branch"
            git -C "$REPO_PATH" push origin --delete "$branch" 2>/dev/null || \
                warn "Failed to delete remote branch $branch"
        fi
    fi
}

# Prune stale remote tracking refs
prune_remote_refs() {
    log "Pruning stale remote tracking refs..."
    
    if [ "$DRY_RUN" = true ]; then
        log "[DRY RUN] Would run: git remote prune origin"
    else
        git -C "$REPO_PATH" remote prune origin
    fi
}

# Main cleanup function
main() {
    log "Starting stale branch cleanup..."
    log "Repository: $REPO_PATH"
    log "Worktrees path: $WORKTREES_PATH"
    
    if [ "$DRY_RUN" = true ]; then
        warn "DRY RUN mode - no changes will be made"
    fi
    
    # Fetch branches from Clutch
    log "Fetching branch lists from Clutch..."
    local done_branches=$(fetch_done_branches)
    local active_branches=$(fetch_active_branches)
    
    local done_count=$(echo "$done_branches" | grep -c '^fix/' 2>/dev/null || echo 0)
    local active_count=$(echo "$active_branches" | grep -c '^fix/' 2>/dev/null || echo 0)
    
    log "Found $done_count done task branches"
    log "Found $active_count active task branches (in_progress, in_review, ready)"
    
    # Get current worktrees
    local current_worktrees=$(git -C "$REPO_PATH" worktree list | grep -v '\[main\]$' | awk '{print $NF}' | tr -d '[]' | sort -u)
    local worktree_count=$(echo "$current_worktrees" | grep -c 'fix/' 2>/dev/null || echo 0)
    log "Found $worktree_count worktrees (excluding main)"
    
    # Get local fix branches
    local local_branches=$(git -C "$REPO_PATH" branch --format='%(refname:short)' | grep -E '^fix/' | sort -u)
    local local_count=$(echo "$local_branches" | grep -c 'fix/' 2>/dev/null || echo 0)
    log "Found $local_count local fix/* branches"
    
    # Find worktrees to remove (done branches that have worktrees)
    log ""
    log "=== Phase 1: Remove orphan worktrees ==="
    local worktrees_removed=0
    for branch in $done_branches; do
        if echo "$current_worktrees" | grep -qx "$branch"; then
            remove_worktree "$branch"
            ((worktrees_removed++)) || true
        fi
    done
    log "Processed $worktrees_removed worktrees for removal"
    
    # Find local branches to delete (done branches that aren't active)
    log ""
    log "=== Phase 2: Delete local branches for done tasks ==="
    local branches_deleted=0
    for branch in $done_branches; do
        # Skip if still active
        if echo "$active_branches" | grep -qx "$branch"; then
            warn "Branch $branch is marked as done but also active, skipping"
            continue
        fi
        
        # Check if local branch exists
        if echo "$local_branches" | grep -qx "$branch"; then
            delete_local_branch "$branch"
            ((branches_deleted++)) || true
        fi
    done
    log "Processed $branches_deleted local branches for deletion"
    
    # Delete remote branches for done tasks
    log ""
    log "=== Phase 3: Delete remote branches for done tasks ==="
    local remote_deleted=0
    for branch in $done_branches; do
        # Skip if still active
        if echo "$active_branches" | grep -qx "$branch"; then
            continue
        fi
        
        delete_remote_branch "$branch"
        ((remote_deleted++)) || true
    done
    log "Processed $remote_deleted remote branches for deletion"
    
    # Prune stale remote refs
    log ""
    log "=== Phase 4: Prune stale remote tracking refs ==="
    prune_remote_refs
    
    # Summary
    log ""
    log "=== Summary ==="
    log "Worktrees removed: $worktrees_removed"
    log "Local branches deleted: $branches_deleted"
    log "Remote branches checked: $remote_deleted"
    
    # Show remaining worktrees
    local remaining_worktrees=$(git -C "$REPO_PATH" worktree list | grep -c 'fix/' || echo 0)
    log "Remaining fix/* worktrees: $remaining_worktrees"
    
    # Show remaining local branches
    local remaining_branches=$(git -C "$REPO_PATH" branch | grep -c 'fix/' || echo 0)
    log "Remaining fix/* local branches: $remaining_branches"
}

# Handle arguments
case "${1:-}" in
    --dry-run)
        DRY_RUN=true
        main
        ;;
    --help|-h)
        echo "Usage: $0 [--dry-run]"
        echo ""
        echo "Removes stale worktrees and branches for done tasks in Clutch."
        echo ""
        echo "Options:"
        echo "  --dry-run    Show what would be done without making changes"
        echo "  --help       Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  DRY_RUN=true  Same as --dry-run flag"
        exit 0
        ;;
    *)
        main
        ;;
esac
