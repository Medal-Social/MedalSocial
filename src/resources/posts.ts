import type { BaseClient, RequestOptions } from "../client";
import type { ApiResponse, PaginatedResponse } from "../types/common";
import type {
  Channel,
  CreatePostInput,
  ListPostsOptions,
  Post,
  PostDetail,
  PublishResult,
  SchedulePostInput,
  ScheduleResult,
  UpdatePostInput,
} from "../types/posts";

/** Create and publish posts across connected channels. */
export class Posts {
  constructor(private client: BaseClient) {}

  /** List posts with cursor-based pagination and optional filters. */
  async list(options?: ListPostsOptions): Promise<PaginatedResponse<Post>> {
    const params: Record<string, string | undefined> = {};
    if (options?.limit !== undefined) params.limit = String(options.limit);
    if (options?.cursor) params.cursor = options.cursor;
    if (options?.status) params.status = options.status;
    if (options?.type) params.type = options.type;
    if (options?.scheduled_from !== undefined) {
      params.scheduled_from = String(options.scheduled_from);
    }
    if (options?.scheduled_to !== undefined) params.scheduled_to = String(options.scheduled_to);
    if (options?.published_from !== undefined) {
      params.published_from = String(options.published_from);
    }
    if (options?.published_to !== undefined) params.published_to = String(options.published_to);
    if (options?.platforms) params.platforms = options.platforms.join(",");
    if (options?.query) params.query = options.query;
    return this.client.get("/api/v1/posts", params);
  }

  /**
   * Create a new post with content and target channels.
   *
   * Automatically idempotent: the SDK mints an `Idempotency-Key` so its own
   * 5xx retries replay rather than draft the post twice. Supply
   * `options.idempotencyKey` to deduplicate across your OWN retries too.
   */
  async create(
    input: CreatePostInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<{ id: string }>> {
    return this.client.postOnce("/api/v1/posts", input, options);
  }

  /** Get a post by ID, including its per-channel variants. */
  async get(id: string): Promise<ApiResponse<PostDetail>> {
    return this.client.get(`/api/v1/posts/${encodeURIComponent(id)}`);
  }

  /** Update a draft post's title or content. */
  async update(id: string, input: UpdatePostInput): Promise<ApiResponse<{ success: boolean }>> {
    return this.client.patch(`/api/v1/posts/${encodeURIComponent(id)}`, input);
  }

  /** Delete a post. */
  async remove(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.client.delete(`/api/v1/posts/${encodeURIComponent(id)}`);
  }

  /**
   * Schedule a post for future publication.
   *
   * Deliberately unkeyed: re-sending the same `scheduled_at` for an
   * already-scheduled post returns the original `workflow_id` rather than
   * starting a second one, so a retried schedule cannot double-publish. A
   * *different* time is rejected — unschedule first.
   */
  async schedule(id: string, input: SchedulePostInput): Promise<ApiResponse<ScheduleResult>> {
    return this.client.post(`/api/v1/posts/${encodeURIComponent(id)}/schedule`, input);
  }

  /**
   * Publish a post immediately to all target channels.
   *
   * Deliberately unkeyed: publishing moves the post out of the set of statuses
   * that may be published, so the retry of a publish that already committed is
   * refused rather than posting a second time. It is refused with a 400 though
   * — treat an error here as "check the post's status", not as "nothing
   * happened".
   */
  async publish(id: string): Promise<ApiResponse<PublishResult>> {
    return this.client.post(`/api/v1/posts/${encodeURIComponent(id)}/publish`);
  }

  /** List connected publishing channels for this workspace. */
  async channels(): Promise<ApiResponse<Channel[]>> {
    return this.client.get("/api/v1/posts/channels");
  }
}
