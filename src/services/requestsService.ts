import { supabase } from "../lib/supabaseClient";
import { getUserBandRole } from "./bandMembersService";

// ============================================
// Types
// ============================================

export type RequestType = "new_song" | "backing_track" | "setlist_proposal" | "song_change" | "general";
export type RequestStatus = "pending" | "approved" | "rejected" | "in_progress" | "completed" | "withdrawn";

export interface Request {
  id: string;
  band_id: number;
  created_by: string;
  request_type: RequestType;
  status: RequestStatus;
  title: string;
  description?: string;
  request_data: Record<string, unknown>;
  related_song_id?: string | null;
  related_setlist_id?: string | null;
  related_show_id?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
  // Populated fields
  creator_name?: string;
  resolver_name?: string;
  vote_count?: number;
  user_vote?: "up" | "down" | null;
  comment_count?: number;
}

export interface RequestComment {
  id: string;
  request_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  // Populated fields
  user_name?: string;
}

export interface RequestVote {
  request_id: string;
  user_id: string;
  vote_type: "up" | "down";
  created_at: string;
}

export interface CreateRequestInput {
  band_id: number;
  request_type: RequestType;
  title: string;
  description?: string;
  request_data?: Record<string, unknown>;
  related_song_id?: string;
  related_setlist_id?: string;
  related_show_id?: string;
}

export interface UpdateRequestInput {
  title?: string;
  description?: string;
  request_data?: Record<string, unknown>;
  related_song_id?: string | null;
  related_setlist_id?: string | null;
  related_show_id?: string | null;
}

export interface RequestFilters {
  status?: RequestStatus | RequestStatus[];
  request_type?: RequestType | RequestType[];
  created_by?: string;
}

// ============================================
// Permission Utilities
// ============================================

/**
 * Check if a role can create requests
 * Allowed: owner, admin, member (not guest)
 */
export function canCreateRequests(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/**
 * Check if a role can manage requests (approve/reject)
 * Allowed: owner, admin
 */
export function canManageRequests(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Check if current user can create requests in a band
 */
export async function canUserCreateRequests(bandId: number): Promise<boolean> {
  const role = await getUserBandRole(bandId);
  return canCreateRequests(role);
}

/**
 * Check if current user can manage requests in a band
 */
export async function canUserManageRequests(bandId: number): Promise<boolean> {
  const role = await getUserBandRole(bandId);
  return canManageRequests(role);
}

// ============================================
// Request CRUD
// ============================================

/**
 * Get all requests for a band with optional filters
 */
export async function getBandRequests(
  bandId: number,
  filters?: RequestFilters
): Promise<Request[]> {
  let query = supabase
    .from("requests")
    .select("*")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });

  // Apply filters
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in("status", filters.status);
    } else {
      query = query.eq("status", filters.status);
    }
  }

  if (filters?.request_type) {
    if (Array.isArray(filters.request_type)) {
      query = query.in("request_type", filters.request_type);
    } else {
      query = query.eq("request_type", filters.request_type);
    }
  }

  if (filters?.created_by) {
    query = query.eq("created_by", filters.created_by);
  }

  const { data, error } = await query;
  if (error) throw error;

  const requests = data || [];

  // Fetch creator names and vote counts
  return await enrichRequestsWithMetadata(requests);
}

/**
 * Get pending requests count for a band
 */
export async function getPendingRequestsCount(bandId: number): Promise<number> {
  const { count, error } = await supabase
    .from("requests")
    .select("*", { count: "exact", head: true })
    .eq("band_id", bandId)
    .eq("status", "pending");

  if (error) throw error;
  return count || 0;
}

/**
 * Get a single request by ID
 */
export async function getRequest(requestId: string): Promise<Request> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error) throw error;

  // Enrich with metadata
  const enriched = await enrichRequestsWithMetadata([data]);
  return enriched[0];
}

/**
 * Create a new request
 */
export async function createRequest(input: CreateRequestInput): Promise<Request> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Check permission
  const hasPermission = await canUserCreateRequests(input.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to create requests in this band");
  }

  const { data, error } = await supabase
    .from("requests")
    .insert([
      {
        ...input,
        created_by: user.id,
        status: "pending",
        request_data: input.request_data || {},
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing request
 */
export async function updateRequest(
  requestId: string,
  updates: UpdateRequestInput
): Promise<Request> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Get the request to check permissions
  const { data: request, error: fetchError } = await supabase
    .from("requests")
    .select("band_id, created_by, status")
    .eq("id", requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!request) throw new Error("Request not found");

  // Only creator can update, and only if still pending
  const isCreator = request.created_by === user.id;
  const isAdmin = await canUserManageRequests(request.band_id);

  if (!isCreator && !isAdmin) {
    throw new Error("You don't have permission to update this request");
  }

  if (request.status !== "pending" && !isAdmin) {
    throw new Error("Only pending requests can be updated");
  }

  const { data, error } = await supabase
    .from("requests")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a request
 */
export async function deleteRequest(requestId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Get the request to check permissions
  const { data: request, error: fetchError } = await supabase
    .from("requests")
    .select("band_id, created_by")
    .eq("id", requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!request) throw new Error("Request not found");

  // Creator or admin can delete
  const isCreator = request.created_by === user.id;
  const isAdmin = await canUserManageRequests(request.band_id);

  if (!isCreator && !isAdmin) {
    throw new Error("You don't have permission to delete this request");
  }

  const { error } = await supabase
    .from("requests")
    .delete()
    .eq("id", requestId);

  if (error) throw error;
}

// ============================================
// Status Actions
// ============================================

/**
 * Approve a request (owner/admin only)
 */
export async function approveRequest(
  requestId: string,
  notes?: string
): Promise<Request> {
  return changeRequestStatus(requestId, "approved", notes);
}

/**
 * Reject a request (owner/admin only)
 */
export async function rejectRequest(
  requestId: string,
  notes?: string
): Promise<Request> {
  return changeRequestStatus(requestId, "rejected", notes);
}

/**
 * Mark request as in progress (owner/admin only)
 */
export async function markRequestInProgress(
  requestId: string,
  notes?: string
): Promise<Request> {
  return changeRequestStatus(requestId, "in_progress", notes);
}

/**
 * Mark request as completed (owner/admin only)
 */
export async function markRequestCompleted(
  requestId: string,
  notes?: string
): Promise<Request> {
  return changeRequestStatus(requestId, "completed", notes);
}

/**
 * Withdraw a request (creator only, or admin)
 */
export async function withdrawRequest(requestId: string): Promise<Request> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Get the request
  const { data: request, error: fetchError } = await supabase
    .from("requests")
    .select("band_id, created_by, status")
    .eq("id", requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!request) throw new Error("Request not found");

  // Only creator or admin can withdraw
  const isCreator = request.created_by === user.id;
  const isAdmin = await canUserManageRequests(request.band_id);

  if (!isCreator && !isAdmin) {
    throw new Error("You don't have permission to withdraw this request");
  }

  // Can only withdraw pending or approved requests
  if (!["pending", "approved"].includes(request.status)) {
    throw new Error("Only pending or approved requests can be withdrawn");
  }

  const { data, error } = await supabase
    .from("requests")
    .update({
      status: "withdrawn",
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Internal function to change request status
 */
async function changeRequestStatus(
  requestId: string,
  status: RequestStatus,
  notes?: string
): Promise<Request> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Get the request to check permissions
  const { data: request, error: fetchError } = await supabase
    .from("requests")
    .select("band_id")
    .eq("id", requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!request) throw new Error("Request not found");

  // Check admin permission
  const hasPermission = await canUserManageRequests(request.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to manage requests in this band");
  }

  const updateData: Record<string, unknown> = {
    status,
    resolved_by: user.id,
    resolved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (notes !== undefined) {
    updateData.resolution_notes = notes;
  }

  const { data, error } = await supabase
    .from("requests")
    .update(updateData)
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// Comments
// ============================================

/**
 * Get comments for a request
 */
export async function getRequestComments(requestId: string): Promise<RequestComment[]> {
  const { data, error } = await supabase
    .from("request_comments")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const comments = data || [];

  // Fetch user names
  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const userNames = await fetchUserNames(userIds);

  return comments.map((comment) => ({
    ...comment,
    user_name: userNames[comment.user_id] || "Unknown",
  }));
}

/**
 * Add a comment to a request
 */
export async function addComment(
  requestId: string,
  content: string
): Promise<RequestComment> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Get the request to check band membership
  const { data: request, error: fetchError } = await supabase
    .from("requests")
    .select("band_id")
    .eq("id", requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!request) throw new Error("Request not found");

  // Check permission (member+ can comment)
  const hasPermission = await canUserCreateRequests(request.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to comment on this request");
  }

  const { data, error } = await supabase
    .from("request_comments")
    .insert([
      {
        request_id: requestId,
        user_id: user.id,
        content,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  // Fetch user name
  const userNames = await fetchUserNames([user.id]);
  return {
    ...data,
    user_name: userNames[user.id] || "You",
  };
}

/**
 * Update a comment
 */
export async function updateComment(
  commentId: string,
  content: string
): Promise<RequestComment> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Verify ownership
  const { data: comment, error: fetchError } = await supabase
    .from("request_comments")
    .select("user_id")
    .eq("id", commentId)
    .single();

  if (fetchError) throw fetchError;
  if (!comment) throw new Error("Comment not found");
  if (comment.user_id !== user.id) {
    throw new Error("You can only edit your own comments");
  }

  const { data, error } = await supabase
    .from("request_comments")
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Get comment and request to check permissions
  const { data: comment, error: fetchError } = await supabase
    .from("request_comments")
    .select("user_id, request_id")
    .eq("id", commentId)
    .single();

  if (fetchError) throw fetchError;
  if (!comment) throw new Error("Comment not found");

  // Check if user is owner of comment or admin
  const isOwner = comment.user_id === user.id;

  if (!isOwner) {
    // Check if admin
    const { data: request } = await supabase
      .from("requests")
      .select("band_id")
      .eq("id", comment.request_id)
      .single();

    if (request) {
      const isAdmin = await canUserManageRequests(request.band_id);
      if (!isAdmin) {
        throw new Error("You can only delete your own comments");
      }
    }
  }

  const { error } = await supabase
    .from("request_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw error;
}

// ============================================
// Votes
// ============================================

/**
 * Get vote summary for a request
 */
export async function getRequestVotes(requestId: string): Promise<{
  upvotes: number;
  downvotes: number;
  total: number;
}> {
  const { data, error } = await supabase
    .from("request_votes")
    .select("vote_type")
    .eq("request_id", requestId);

  if (error) throw error;

  const votes = data || [];
  const upvotes = votes.filter((v) => v.vote_type === "up").length;
  const downvotes = votes.filter((v) => v.vote_type === "down").length;

  return {
    upvotes,
    downvotes,
    total: upvotes - downvotes,
  };
}

/**
 * Get current user's vote on a request
 */
export async function getUserVote(requestId: string): Promise<"up" | "down" | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("request_votes")
    .select("vote_type")
    .eq("request_id", requestId)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data?.vote_type as "up" | "down" | null;
}

/**
 * Vote on a request (upvote or downvote)
 */
export async function voteRequest(
  requestId: string,
  voteType: "up" | "down"
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  // Get the request to check band membership
  const { data: request, error: fetchError } = await supabase
    .from("requests")
    .select("band_id")
    .eq("id", requestId)
    .single();

  if (fetchError) throw fetchError;
  if (!request) throw new Error("Request not found");

  // Check permission
  const hasPermission = await canUserCreateRequests(request.band_id);
  if (!hasPermission) {
    throw new Error("You don't have permission to vote on this request");
  }

  // Upsert vote (insert or update)
  const { error } = await supabase
    .from("request_votes")
    .upsert(
      {
        request_id: requestId,
        user_id: user.id,
        vote_type: voteType,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: "request_id,user_id",
      }
    );

  if (error) throw error;
}

/**
 * Remove vote from a request
 */
export async function removeVote(requestId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("request_votes")
    .delete()
    .eq("request_id", requestId)
    .eq("user_id", user.id);

  if (error) throw error;
}

/**
 * Toggle vote on a request
 * If no vote exists, adds the vote
 * If same vote exists, removes it
 * If different vote exists, changes it
 */
export async function toggleVote(
  requestId: string,
  voteType: "up" | "down"
): Promise<"added" | "removed" | "changed"> {
  const currentVote = await getUserVote(requestId);

  if (currentVote === null) {
    await voteRequest(requestId, voteType);
    return "added";
  } else if (currentVote === voteType) {
    await removeVote(requestId);
    return "removed";
  } else {
    await voteRequest(requestId, voteType);
    return "changed";
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Fetch user display names
 */
async function fetchUserNames(userIds: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};

  for (const userId of userIds) {
    try {
      const { data: displayName } = await supabase.rpc("get_user_display_name", {
        user_id_param: userId,
      });
      if (displayName) {
        names[userId] = displayName;
      }
    } catch {
      // Function may not exist
    }
  }

  return names;
}

/**
 * Enrich requests with metadata (creator names, vote counts, etc.)
 */
async function enrichRequestsWithMetadata(requests: Request[]): Promise<Request[]> {
  if (requests.length === 0) return [];

  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData.user?.id;

  // Fetch creator names
  const creatorIds = [...new Set(requests.map((r) => r.created_by))];
  const resolverIds = [...new Set(requests.filter((r) => r.resolved_by).map((r) => r.resolved_by!))];
  const allUserIds = [...new Set([...creatorIds, ...resolverIds])];
  const userNames = await fetchUserNames(allUserIds);

  // Fetch vote counts for all requests
  const requestIds = requests.map((r) => r.id);

  const { data: allVotes } = await supabase
    .from("request_votes")
    .select("request_id, vote_type, user_id")
    .in("request_id", requestIds);

  const voteCounts: Record<string, number> = {};
  const userVotes: Record<string, "up" | "down" | null> = {};

  (allVotes || []).forEach((vote) => {
    if (!voteCounts[vote.request_id]) {
      voteCounts[vote.request_id] = 0;
    }
    voteCounts[vote.request_id] += vote.vote_type === "up" ? 1 : -1;

    if (currentUserId && vote.user_id === currentUserId) {
      userVotes[vote.request_id] = vote.vote_type as "up" | "down";
    }
  });

  // Fetch comment counts
  const { data: commentCounts } = await supabase
    .from("request_comments")
    .select("request_id")
    .in("request_id", requestIds);

  const commentCountMap: Record<string, number> = {};
  (commentCounts || []).forEach((c) => {
    commentCountMap[c.request_id] = (commentCountMap[c.request_id] || 0) + 1;
  });

  return requests.map((request) => ({
    ...request,
    creator_name: userNames[request.created_by] || "Unknown",
    resolver_name: request.resolved_by ? userNames[request.resolved_by] || "Unknown" : undefined,
    vote_count: voteCounts[request.id] || 0,
    user_vote: userVotes[request.id] || null,
    comment_count: commentCountMap[request.id] || 0,
  }));
}

// ============================================
// Request Type Helpers
// ============================================

/**
 * Get localization key for request type
 */
export function getRequestTypeKey(type: RequestType): string {
  const keys: Record<RequestType, string> = {
    new_song: "requests.types.new_song",
    backing_track: "requests.types.backing_track",
    setlist_proposal: "requests.types.setlist_proposal",
    song_change: "requests.types.song_change",
    general: "requests.types.general",
  };
  return keys[type];
}

/**
 * Get localization key for request status
 */
export function getRequestStatusKey(status: RequestStatus): string {
  const keys: Record<RequestStatus, string> = {
    pending: "requests.status.pending",
    approved: "requests.status.approved",
    rejected: "requests.status.rejected",
    in_progress: "requests.status.in_progress",
    completed: "requests.status.completed",
    withdrawn: "requests.status.withdrawn",
  };
  return keys[status];
}

/**
 * Get Bootstrap color class for request status
 */
export function getRequestStatusColor(status: RequestStatus): string {
  const colors: Record<RequestStatus, string> = {
    pending: "warning",
    approved: "success",
    rejected: "danger",
    in_progress: "info",
    completed: "secondary",
    withdrawn: "dark",
  };
  return colors[status];
}

/**
 * Get icon class for request type
 */
export function getRequestTypeIcon(type: RequestType): string {
  const icons: Record<RequestType, string> = {
    new_song: "bi-music-note-beamed",
    backing_track: "bi-soundwave",
    setlist_proposal: "bi-list-ol",
    song_change: "bi-pencil-square",
    general: "bi-chat-dots",
  };
  return icons[type];
}
