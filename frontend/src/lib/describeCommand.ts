/**
 * Maps a bpmn-js command + context to a human-readable action string.
 * Returns null for commands that should not appear in the activity feed
 * (e.g. internal commands like element.setColor).
 */
export function describeCommand(command: string, context: any): string | null {
  const shape = context.shape ?? context.shapes?.[0]
  const conn  = context.connection ?? context.connections?.[0]
  const el    = shape ?? conn
  if (!el) return null

  const bpmnType = (el.type ?? '').split(':')[1] ?? ''
  const typeNames: Record<string, string> = {
    Task:             'task',
    StartEvent:       'start event',
    EndEvent:         'end event',
    ExclusiveGateway: 'gateway',
    ParallelGateway:  'gateway',
    InclusiveGateway: 'gateway',
    SubProcess:       'subprocess',
    SequenceFlow:     'connection',
    MessageFlow:      'connection',
  }
  const typeName =
    Object.entries(typeNames).find(([k]) => bpmnType.includes(k))?.[1] ?? 'element'
  const label = el.businessObject?.name
  const named = label ? ` "${label}"` : ''

  switch (command) {
    case 'shape.create':             return `added ${typeName}${named}`
    case 'shape.delete':             return `deleted ${typeName}${named}`
    case 'shape.move':
    case 'elements.move':            return `moved ${typeName}${named}`
    case 'shape.resize':             return `resized ${typeName}${named}`
    case 'element.updateProperties': return `updated ${typeName}${named}`
    case 'connection.create':        return `added connection`
    case 'connection.delete':        return `deleted connection`
    default:                         return null
  }
}
