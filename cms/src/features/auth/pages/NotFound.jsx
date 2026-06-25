import { useNavigate } from "react-router-dom";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { Button, Card, CardBody } from "../../../components/ui";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <QuestionMarkCircleIcon className="h-7 w-7" />
          </span>
          <div>
            <p className="text-5xl font-bold tracking-tight text-primary">404</p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              Page not found
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The page you’re looking for doesn’t exist or has been moved.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go back
            </Button>
            <Button onClick={() => navigate("/")}>Go home</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
