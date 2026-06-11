type CheckResult = {
  detail?: string;
  name: string;
  ok: boolean;
};

const baseUrl = (
  process.env.QA_BASE_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const adminEmail = process.env.QA_ADMIN_EMAIL;
const adminPassword = process.env.QA_ADMIN_PASSWORD;
const requireEmailReady = process.env.QA_REQUIRE_EMAIL_READY === "true";

function getSetCookies(headers: Headers) {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }

  const cookieHeader = headers.get("set-cookie");
  return cookieHeader ? cookieHeader.split(/,(?=\s*[^;=]+=[^;]+)/) : [];
}

function mergeCookies(current: string, response: Response) {
  const nextCookies = new Map<string, string>();

  current
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [name, ...valueParts] = part.split("=");
      nextCookies.set(name, `${name}=${valueParts.join("=")}`);
    });

  getSetCookies(response.headers).forEach((cookie) => {
    const [pair] = cookie.split(";");
    const [name] = pair.split("=");
    nextCookies.set(name, pair);
  });

  return Array.from(nextCookies.values()).join("; ");
}

async function fetchWithCookies(
  path: string,
  init: RequestInit = {},
  cookieJar = ""
) {
  const headers = new Headers(init.headers);
  if (cookieJar) {
    headers.set("cookie", cookieJar);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...init,
    headers
  });

  return {
    response,
    cookieJar: mergeCookies(cookieJar, response)
  };
}

function record(results: CheckResult[], name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
}

async function main() {
  const results: CheckResult[] = [];

  const healthPath = requireEmailReady ? "/api/health?scope=readiness" : "/api/health";
  const health = await fetch(`${baseUrl}${healthPath}`);
  const healthBody = await health.json().catch(() => null);
  record(
    results,
    requireEmailReady ? "readiness health" : "core health",
    health.ok,
    JSON.stringify(healthBody)
  );

  const loginPage = await fetch(`${baseUrl}/login`, { redirect: "manual" });
  record(results, "login page loads", loginPage.status === 200, `status=${loginPage.status}`);

  const protectedPage = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  record(
    results,
    "protected admin redirects without session",
    protectedPage.status === 307 && protectedPage.headers.get("location") === "/login",
    `status=${protectedPage.status} location=${protectedPage.headers.get("location")}`
  );

  if (adminEmail && adminPassword) {
    let cookieJar = "";
    const csrfResult = await fetchWithCookies("/api/auth/csrf", {}, cookieJar);
    cookieJar = csrfResult.cookieJar;
    const csrfBody = await csrfResult.response.json();

    const form = new URLSearchParams({
      csrfToken: csrfBody.csrfToken,
      email: adminEmail,
      password: adminPassword,
      redirect: "false",
      callbackUrl: "/admin",
      json: "true"
    });

    const loginResult = await fetchWithCookies(
      "/api/auth/callback/credentials",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form
      },
      cookieJar
    );
    cookieJar = loginResult.cookieJar;
    const loginBody = await loginResult.response.json().catch(() => ({}));
    record(
      results,
      "admin credentials login",
      loginResult.response.ok && String(loginBody.url ?? "").endsWith("/admin"),
      `status=${loginResult.response.status}`
    );

    const authenticatedChecks: Array<[string, number]> = [
      ["/admin", 200],
      ["/api/dashboard/admin", 200],
      ["/api/settings", 200],
      ["/api/points", 200],
      ["/api/volunteers", 200],
      ["/api/schedule/week", 200],
      ["/api/dashboard/volunteer", 403]
    ];

    for (const [path, expectedStatus] of authenticatedChecks) {
      const checked = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: cookieJar },
        redirect: "manual"
      });
      record(
        results,
        `${path} returns ${expectedStatus}`,
        checked.status === expectedStatus,
        `status=${checked.status}`
      );
    }
  } else {
    record(
      results,
      "authenticated admin checks skipped",
      true,
      "Set QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD to include login/API checks."
    );
  }

  const failed = results.filter((result) => !result.ok);

  for (const result of results) {
    const prefix = result.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${result.name}${result.detail ? ` - ${result.detail}` : ""}`);
  }

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
