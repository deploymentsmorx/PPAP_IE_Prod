import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddPersonForm } from "@/components/add-person-form";
import { EditPersonRoles } from "@/components/edit-person-roles";

export default async function UsersPage() {
  await requirePagePermission("manageUsers");
  const [users, customers] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, designation: true, roles: true, customerId: true, customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Person</CardTitle>
        </CardHeader>
        <CardContent>
          <AddPersonForm customers={customers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.designation ?? "—"}</TableCell>
                  <TableCell>{u.roles.length ? u.roles.join(", ") : "—"}</TableCell>
                  <TableCell>{u.customer?.name ?? "—"}</TableCell>
                  <TableCell>
                    <EditPersonRoles
                      userId={u.id}
                      initialRoles={u.roles}
                      initialCustomerId={u.customerId}
                      customers={customers}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
