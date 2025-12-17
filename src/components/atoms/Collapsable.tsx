import { useId, useState } from "react";

type Props = {
    expandText: string;
    collapseText: string;
    initialValues: React.ReactNode[];
    collapsedValues: React.ReactNode[];
};

export default function Collapsable({
    expandText,
    collapseText,
    initialValues,
    collapsedValues,
}: Props) {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const id = useId();

    return (
        <div className="font-title p-2 my-2">
            <div className="flex flex-wrap space-y-2 space-x-2 mb-4" id={id}>
                {initialValues}
                {isCollapsed || collapsedValues}
            </div>
            <button
                className="text-sm text-code-blue-1 hover:underline"
                onClick={() => setIsCollapsed((prev) => !prev)}
                aria-expanded={!isCollapsed}
                aria-controls={id}
            >
                {isCollapsed ? expandText : collapseText}
            </button>
        </div>
    );
}
