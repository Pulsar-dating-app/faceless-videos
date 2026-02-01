import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket for generated videos
const VIDEO_STORAGE_BUCKET = "generated-videos";

// How many days to keep videos before deletion (default: 7 days)
const DAYS_TO_KEEP = parseInt(process.env.VIDEO_RETENTION_DAYS || "7", 10);

// Support both GET (for Vercel Cron) and POST (for manual triggers)
export async function GET(request: Request) {
  return handleCleanup(request);
}

export async function POST(request: Request) {
  return handleCleanup(request);
}

async function handleCleanup(request: Request) {
  // Optional: Add a secret token for security (prevents unauthorized access)
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CLEANUP_SECRET_TOKEN;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    console.log(`🧹 Starting video cleanup (keeping videos older than ${DAYS_TO_KEEP} days)...`);

    // List all files in the videos folder
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(VIDEO_STORAGE_BUCKET)
      .list("videos", {
        limit: 1000,
        sortBy: { column: "created_at", order: "asc" },
      });

    if (listError) {
      console.error("Error listing files:", listError);
      throw new Error("Failed to list videos");
    }

    if (!files || files.length === 0) {
      return NextResponse.json({
        message: "No videos found",
        deleted: 0,
        kept: 0,
      });
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - DAYS_TO_KEEP * 24 * 60 * 60 * 1000);
    
    const filesToDelete: string[] = [];
    const filesToKeep: string[] = [];

    for (const file of files) {
      if (!file.created_at) {
        // If created_at is missing, skip it (shouldn't happen, but safety check)
        console.warn(`File ${file.name} has no created_at, skipping`);
        continue;
      }

      const fileDate = new Date(file.created_at);
      
      if (fileDate < cutoffDate) {
        filesToDelete.push(`videos/${file.name}`);
      } else {
        filesToKeep.push(file.name);
      }
    }

    console.log(`Found ${files.length} videos: ${filesToDelete.length} to delete, ${filesToKeep.length} to keep`);

    // Delete old files
    let deletedCount = 0;
    let errorCount = 0;

    if (filesToDelete.length > 0) {
      // Delete in batches (Supabase allows up to 1000 files per request)
      const batchSize = 100;
      for (let i = 0; i < filesToDelete.length; i += batchSize) {
        const batch = filesToDelete.slice(i, i + batchSize);
        
        const { error: deleteError } = await supabaseAdmin.storage
          .from(VIDEO_STORAGE_BUCKET)
          .remove(batch);

        if (deleteError) {
          console.error(`Error deleting batch:`, deleteError);
          errorCount += batch.length;
        } else {
          deletedCount += batch.length;
          console.log(`✅ Deleted ${batch.length} videos (batch ${Math.floor(i / batchSize) + 1})`);
        }
      }
    }

    const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
    const deletedSize = filesToDelete
      .map(path => {
        const fileName = path.split("/").pop() || "";
        const file = files.find(f => f.name === fileName);
        return file?.metadata?.size || 0;
      })
      .reduce((sum, size) => sum + size, 0);

    return NextResponse.json({
      message: "Cleanup completed",
      total: files.length,
      deleted: deletedCount,
      kept: filesToKeep.length,
      errors: errorCount,
      storageFreed: `${(deletedSize / 1024 / 1024).toFixed(2)} MB`,
      retentionDays: DAYS_TO_KEEP,
    });

  } catch (error: any) {
    console.error("Error in cleanup:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to cleanup videos" },
      { status: 500 }
    );
  }
}
