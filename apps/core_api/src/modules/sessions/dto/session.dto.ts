export class SessionDto {
  id: string;
  sectionId: string;
  periodId: string | null;

  sessionDate: string; // YYYY-MM-DD
  weekLabel: string | null;

  topicTitle: string;
  topicDescription: string | null;

  createdBy: string;

  createdAt: string;
  updatedAt: string;
}
