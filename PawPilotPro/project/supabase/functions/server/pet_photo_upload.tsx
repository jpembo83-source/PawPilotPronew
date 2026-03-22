import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js";

const app = new Hono();

const getSupabase = () => {
  const url = Deno.env.get("SUPABASE_URL") || "https://ruahrxkfgfyshuxykiay.supabase.co";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  return createClient(url, key);
};

// Upload pet photo endpoint
app.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const petId = formData.get("petId") as string;
    
    if (!file || !petId) {
      return c.json({ error: "Missing file or petId" }, 400);
    }
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      return c.json({ error: "File must be an image" }, 400);
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: "File size must be less than 5MB" }, 400);
    }
    
    const supabase = getSupabase();
    
    // Create unique file name
    const fileExt = file.name.split(".").pop();
    const fileName = `${petId}-${Date.now()}.${fileExt}`;
    const filePath = `pet-photos/${fileName}`;
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage using service role (bypasses RLS)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("make-fc003b23-pet-photos")
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });
    
    if (uploadError) {
      console.error("[Pet Photo Upload] Upload error:", uploadError);
      return c.json({ error: uploadError.message }, 500);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("make-fc003b23-pet-photos")
      .getPublicUrl(filePath);
    
    console.log(`[Pet Photo Upload] ✓ Uploaded photo for pet ${petId}: ${publicUrl}`);
    
    return c.json({ 
      success: true,
      url: publicUrl,
      path: filePath
    });
    
  } catch (error: any) {
    console.error("[Pet Photo Upload] Error:", error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;
