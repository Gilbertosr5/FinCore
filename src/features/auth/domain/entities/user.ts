/** Usuário autenticado. Contém apenas dados não sensíveis. */
export interface User {
  id: string;
  name: string;
  email: string;
}

/** Iniciais para avatar: "Ana Maria Souza" => "AS". */
export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}
