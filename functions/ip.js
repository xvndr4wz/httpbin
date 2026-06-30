export async function onRequest(context) {
  return new Response(
    context.request.headers.get("CF-Connecting-IP") || "Unknown",
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
}
