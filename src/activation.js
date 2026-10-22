const $ = (id) => document.getElementById(id);
function message(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
}
async function run(fn) {
  try {
    await fn();
  } catch (e) {
    message(e.message, true);
  }
}
async function refresh() {
  const s = await issuer.status();
  $("keyStatus").textContent = s.ready ? "IDENTITY READY" : "NOT CONFIGURED";
  $("create").disabled = $("restore").disabled = s.ready;
  $("public").disabled = $("backup").disabled = $("issue").disabled = !s.ready;
  $("keyFolder").textContent = "Signing identity folder: " + s.keyFolder;
}
$("create").onclick = () =>
  run(async () => {
    await issuer.create();
    await refresh();
    message(
      "Signing identity created. Back up your private key and configure GerbCraft releases with the public key.",
    );
  });
$("public").onclick = () =>
  run(async () => {
    const p = await issuer.exportPublic();
    if (p) message("Public key exported to " + p);
  });
$("backup").onclick = () =>
  run(async () => {
    const p = await issuer.backup();
    if (p)
      message(
        "Private key backed up. Store it securely; anyone with this key can issue licences.",
      );
  });
$("duration").onchange = () => {
  $("expires").disabled = $("duration").value === "perpetual";
};
$("issue").onclick = () =>
  run(async () => {
    if ($("duration").value === "dated" && !$("expires").value)
      throw Error("Choose an expiry date.");
    const p = await issuer.issue({
      customer: $("customer").value,
      deviceId: $("device").value,
      expires: $("duration").value === "dated" ? $("expires").value : null,
    });
    if (p) message("Licence created: " + p);
  });
run(refresh);

$("restore").onclick = () =>
  run(async () => {
    if (await issuer.restore()) {
      await refresh();
      message("Signing identity restored.");
    }
  });
