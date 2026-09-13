import { cn } from "cn";

type TailwindCnComponentProps = {
  isRed?: boolean;
};

const TailwindCnComponent = ({ isRed }: TailwindCnComponentProps) => {
  return (
    <>
      <div
        className={cn(
          "p-2 text-base text-blue-500 border-blue-500 border-solid border rounded-sm",
          isRed && "text-red-500 border-red-500",
        )}
      >
        Hello from Benchmark!
      </div>
      <div>
        <div className="mb-2 last:mb-0 min-[800px]:mb-3">First</div>
        <div className="mb-2 last:mb-0 min-[800px]:mb-3">Second</div>
        <div className="mb-2 last:mb-0 min-[800px]:mb-3">Last</div>
      </div>
    </>
  );
};

export default TailwindCnComponent;
