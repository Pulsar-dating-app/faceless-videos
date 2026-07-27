// Active status checks against each platform's API — used as the source of truth for
// posting idempotency instead of trusting a locally-saved id alone.

export type TikTokStatus =
  | 'PROCESSING_UPLOAD'
  | 'PROCESSING_DOWNLOAD'
  | 'SEND_TO_USER_INBOX'
  | 'PUBLISH_COMPLETE'
  | 'FAILED';

export async function checkTikTokStatus(
  publishId: string,
  accessToken: string
): Promise<{ status: TikTokStatus; failReason?: string }> {
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ publish_id: publishId }),
  });

  if (!response.ok) {
    throw new Error(`TikTok status fetch failed: ${await response.text()}`);
  }

  const data = await response.json();
  return { status: data.data.status, failReason: data.data.fail_reason };
}

export type InstagramContainerStatus = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';

export async function checkInstagramContainerStatus(
  containerId: string,
  accessToken: string
): Promise<InstagramContainerStatus> {
  const response = await fetch(
    `https://graph.instagram.com/v21.0/${containerId}?fields=status_code&access_token=${accessToken}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Instagram container status fetch failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.status_code;
}

export type YouTubeUploadStatus = 'uploaded' | 'processed' | 'failed' | 'rejected' | 'deleted';

export async function checkYouTubeVideoStatus(
  videoId: string,
  accessToken: string
): Promise<YouTubeUploadStatus | null> {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`YouTube status fetch failed: ${await response.text()}`);
  }

  const data = await response.json();
  const video = data.items?.[0];
  return video ? video.status.uploadStatus : null;
}
