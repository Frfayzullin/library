const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbytZbfHE1Dr2g-1vDgCbryD_vW_ViYeTQcBSX9mQ8ubJ4fxfIMTaqvrLX2Q8PuNVDMZCw/exec";

exports.handler = async function handler(event) {
  try {
    const query = event.rawQuery ? `?${event.rawQuery}` : "";
    const targetUrl = `${APPS_SCRIPT_URL}${query}`;

    const headers = {};
    if (event.headers["content-type"]) {
      headers["content-type"] = event.headers["content-type"];
    }

    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers,
      body: event.httpMethod === "GET" || event.httpMethod === "HEAD" ? undefined : event.body,
      redirect: "follow"
    });

    const text = await response.text();
    return {
      statusCode: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: text
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: JSON.stringify({
        ok: false,
        error: error && error.message ? error.message : String(error || "Proxy error")
      })
    };
  }
};
