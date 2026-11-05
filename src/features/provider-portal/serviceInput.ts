import type { ServiceInput, ServiceItem, ServiceKind } from '../../data';

export function emptyService(kind: ServiceKind): ServiceInput {
  return {
    kind,
    name: '',
    category: null,
    description: null,
    place: null,
    phone: null,
    operating: true,
    beneficiaries: null,
    requiredDocs: [],
    contact: null,
    hours: null,
    location: null,
    eligibility: [],
    howToApply: null,
    startsOn: null,
    endsOn: null,
    programStatus: kind === 'program' ? 'info' : null,
  };
}

export function toInput(s: ServiceItem): ServiceInput {
  const { orgId: _o, confirmedAt: _c, reviewStatus: _r, rejectionReason: _x, updatedAt: _u, ...rest } = s;
  return rest;
}
