import { DataTable } from "@/components/forms/data-table";
import { VolunteerTable } from "@/components/volunteers/volunteer-table";
import { CreateVolunteerForm } from "@/features/volunteers/create-volunteer-form";
import { getVolunteers } from "@/services/volunteer.service";

export default async function AdminVolunteersPage() {
  const volunteers = await getVolunteers();

  return (
    <DataTable
      title="Volunteers"
      description="Manage active volunteers, monitor reliability, and review profile history."
      actions={<CreateVolunteerForm />}
    >
      <VolunteerTable volunteers={volunteers} />
    </DataTable>
  );
}
