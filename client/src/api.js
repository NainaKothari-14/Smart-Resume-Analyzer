const BASE_URL = import.meta.env.VITE_API_URL;

export async function analyzeText(text, role, jdText = "") {
  const res = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, role, jdText }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Server error");
  return json.data;
}

export async function uploadFile(file, role) {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("role", role);
  const res = await fetch(`${BASE_URL}/upload`, { method:"POST", body:formData });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Upload failed");
  return json.data;
}

export async function fetchRoles() {
  const res  = await fetch(`${BASE_URL}/roles`);
  const json = await res.json();
  if (!res.ok) throw new Error("Could not load roles");
  return json.roles;
}