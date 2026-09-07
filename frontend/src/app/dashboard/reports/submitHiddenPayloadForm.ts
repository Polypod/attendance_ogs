type Args = {
  action: string;
  payload: unknown;
  fieldName?: string;
};

export function submitHiddenPayloadForm({ action, payload, fieldName = "payload" }: Args) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = fieldName;
  input.value = JSON.stringify(payload);

  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
