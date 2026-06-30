export async function onRequest(context) {
  console.log("Request diterima:", new Date().toISOString());

  return new Response(
    context.request.headers.get("CF-Connecting-IP") || "Unknown",
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
}
