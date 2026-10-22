export function validateRegistration(values) {
  if (!values.fname.trim()) return "First name is required.";
  if (!values.lname.trim()) return "Last name is required.";
  if (values.username.trim().length < 3) return "Username must be at least 3 characters.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) return "Enter a valid email address.";
  if (!/^\d{10}$/.test(values.contact)) return "Enter a 10-digit contact number.";
  if (values.password.length < 8) return "Password must be at least 8 characters.";
  if (new TextEncoder().encode(values.password).length > 72) return "Password must be at most 72 UTF-8 bytes.";
  if (values.password !== values.confirmPassword) return "Passwords do not match.";
  return "";
}
