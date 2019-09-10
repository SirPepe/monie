export const urlBase64ToUint8Array = (base64Input) => {
  const padding = "=".repeat((4 - base64Input.length % 4) % 4);
  const base64 = (base64Input + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}