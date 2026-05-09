export function getRoutePath(menu: any): string {
  return menu.path || ''
}

export function hasPermission(permissions: string[], required?: string[]): boolean {
  if (!required || required.length === 0) return true
  if (permissions.includes('ROLE_ADMIN')) return true
  return required.some((p) => permissions.includes(p))
}