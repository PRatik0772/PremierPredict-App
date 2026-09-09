const positionLabels: Record<string, string> = {
  GK: 'Goalkeeper',
  LB: 'Left-back',
  CB: 'Centre-back',
  RB: 'Right-back',
  LWB: 'Left wing-back',
  RWB: 'Right wing-back',
  SW: 'Sweeper',
  LCB: 'Left centre-back',
  RCB: 'Right centre-back',
  CM: 'Central midfielder',
  CDM: 'Defensive midfielder',
  CAM: 'Attacking midfielder',
  DM: 'Defensive midfielder',
  AM: 'Attacking midfielder',
  LM: 'Left midfielder',
  RM: 'Right midfielder',
  LMF: 'Left midfielder',
  RMF: 'Right midfielder',
  LW: 'Left winger',
  RW: 'Right winger',
  ST: 'Striker',
  CF: 'Centre-forward',
  FW: 'Forward',
  SS: 'Second striker',
};

export function getPositionLabel(position: string) {
  return positionLabels[position] || position;
}