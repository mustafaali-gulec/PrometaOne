/**
 * Hazır HR DTO fixture'ları — testlerin ortak veri kümesi.
 *
 * Fixture'lar `as const` ile dondurulur ama her test override yapabilsin
 * diye tipler `OrgUnitDto` vb. olarak export'lanır. Tarihler ISO string.
 */
import type {
  ApplicationDto,
  ApplicationsResponse,
  CandidateDto,
  CandidatesResponse,
  DepartmentDto,
  EmployeeDto,
  EmployeesResponse,
  OrgTreeResponse,
  OrgUnitDto,
  PositionDto,
  PositionsResponse,
  RecruitmentFunnelDto,
} from '../../modules/hr/application/dto/HrDtos';

const ISO = '2026-01-01T00:00:00.000Z';

export const orgUnitRoot: OrgUnitDto = {
  id: 1,
  companyId: 100,
  parentId: null,
  name: 'Şirket',
  code: 'ROOT',
  sortOrder: 0,
  active: true,
  createdAt: ISO,
  updatedAt: ISO,
};

export const orgUnitChild: OrgUnitDto = {
  id: 2,
  companyId: 100,
  parentId: 1,
  name: 'Mühendislik',
  code: 'ENG',
  sortOrder: 1,
  active: true,
  createdAt: ISO,
  updatedAt: ISO,
};

export const orgTreeFixture: OrgTreeResponse = {
  tree: [
    {
      unit: orgUnitRoot,
      children: [{ unit: orgUnitChild, children: [] }],
    },
  ],
};

export const departmentFixture: DepartmentDto = {
  id: 10,
  companyId: 100,
  orgUnitId: 2,
  name: 'Backend',
  code: 'BE',
  managerEmployeeId: null,
  active: true,
  createdAt: ISO,
  updatedAt: ISO,
};

export const positionFixture: PositionDto = {
  id: 20,
  companyId: 100,
  departmentId: 10,
  title: 'Senior Engineer',
  description: 'TS / Node',
  status: 'open',
  headcountTarget: 2,
  minSalary: 1000,
  maxSalary: 2000,
  createdAt: ISO,
  updatedAt: ISO,
};

export const positionsFixture: PositionsResponse = {
  positions: [positionFixture],
};

export const employeeFixture: EmployeeDto = {
  id: 30,
  companyId: 100,
  userId: null,
  departmentId: 10,
  positionId: 20,
  employeeNo: 'E-001',
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  tcKimlik: null,
  email: 'ada@example.com',
  phone: null,
  hireDate: '2026-01-01',
  terminationDate: null,
  status: 'active',
  employmentType: 'full_time',
  sourceApplicationId: null,
  createdAt: ISO,
  updatedAt: ISO,
};

export const employeesFixture: EmployeesResponse = {
  employees: [employeeFixture],
};

export const candidateFixture: CandidateDto = {
  id: 40,
  companyId: 100,
  firstName: 'Alan',
  lastName: 'Turing',
  fullName: 'Alan Turing',
  email: 'alan@example.com',
  phone: null,
  source: 'referral',
  cvUrl: null,
  notes: null,
  createdAt: ISO,
  updatedAt: ISO,
};

export const candidatesFixture: CandidatesResponse = {
  candidates: [candidateFixture],
};

export const applicationFixture: ApplicationDto = {
  id: 50,
  companyId: 100,
  candidateId: 40,
  positionId: 20,
  stage: 'screening',
  stageChangedAt: ISO,
  stageChangedBy: null,
  rejectionReason: null,
  salaryExpectation: 1500,
  notes: null,
  createdAt: ISO,
  updatedAt: ISO,
};

export const applicationsFixture: ApplicationsResponse = {
  applications: [applicationFixture],
};

export const funnelFixture: RecruitmentFunnelDto = {
  positionId: 20,
  counts: { new: 5, screening: 3, interview: 2, offer: 1, hired: 0 },
};
