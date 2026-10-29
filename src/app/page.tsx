import { prisma } from "@/lib/prisma";
import { HomeRestaurant } from "@/components/restaurant/HomeRestaurant";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const pendientes = await prisma.pendiente.findMany({
    orderBy: [{ prioridad: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      categoria: true,
      estado: true,
      prioridad: true,
      zone: true,
    },
  });

  return <HomeRestaurant pendientes={pendientes} />;
}
