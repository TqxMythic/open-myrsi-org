import React, { useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';

// A constrained Tiptap editor used on surfaces where the full WikiEditor
// is overkill (Public Landing Page blurb is the first caller). Extension set
// is intentionally narrow — no images, tables, iframes, YouTube, or code
// blocks — so the XSS surface is small and the public bundle stays tiny.
//
// Marks: bold, italic, link
// Nodes: paragraph, heading 2/3, bulletList, orderedList, listItem, hardBreak
//
// Shape mirrors WikiEditor: caller passes Tiptap JSON in `content`, receives
// fresh JSON via `onChange`. The save format is a Tiptap document object;
// callers serialize it to a string for storage in their own field.

interface MinimalRichEditorProps {
    content: any;
    editable: boolean;
    onChange?: (json: any) => void;
    placeholder?: string;
}

const ToolbarButton: React.FC<{
    onClick: () => void;
    isActive?: boolean;
    icon: string;
    title: string;
    disabled?: boolean;
}> = ({ onClick, isActive, icon, title, disabled }) => (
    <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`shrink-0 w-8 h-8 flex items-center justify-center rounded text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            isActive
                ? 'bg-sky-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-700'
        }`}
    >
        <i className={icon} />
    </button>
);

const Divider = () => <div className="shrink-0 w-px h-5 bg-slate-700 mx-0.5" />;

const MinimalToolbar: React.FC<{ editor: Editor }> = ({ editor }) => {
    const promptLink = () => {
        const url = window.prompt('Enter URL (https:// or mailto:):', editor.getAttributes('link').href || '');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().unsetLink().run();
            return;
        }
        editor.chain().focus().setLink({ href: url }).run();
    };

    return (
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-xs border border-slate-700/60 rounded-t-lg flex items-center gap-0.5 p-1.5 overflow-x-auto scrollbar-none">
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                icon="fa-solid fa-bold"
                title="Bold"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                icon="fa-solid fa-italic"
                title="Italic"
            />
            <Divider />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                icon="fa-solid fa-heading"
                title="Heading"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                icon="fa-solid fa-h fa-sm"
                title="Subheading"
            />
            <Divider />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                icon="fa-solid fa-list-ul"
                title="Bullet list"
            />
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                icon="fa-solid fa-list-ol"
                title="Ordered list"
            />
            <Divider />
            <ToolbarButton
                onClick={promptLink}
                isActive={editor.isActive('link')}
                icon="fa-solid fa-link"
                title="Link"
            />
        </div>
    );
};

const MinimalRichEditor: React.FC<MinimalRichEditorProps> = ({ content, editable, onChange, placeholder }) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Restrict heading levels to H2/H3; the blurb sits inside a
                // larger card title so H1 would clash visually.
                heading: { levels: [2, 3] },
                // Disable everything not in the minimal allowlist.
                blockquote: false,
                codeBlock: false,
                code: false,
                strike: false,
                horizontalRule: false,
                link: false,
            }),
            Placeholder.configure({
                placeholder: placeholder || 'Write a brief introduction…',
            }),
            Link.configure({
                openOnClick: !editable,
                autolink: true,
                protocols: ['http', 'https', 'mailto'],
                HTMLAttributes: { class: 'underline text-sky-300 hover:text-sky-200' },
            }),
        ],
        content: content && (typeof content === 'object' ? Object.keys(content).length > 0 : !!content) ? content : undefined,
        editable,
        onUpdate: onChange ? ({ editor: e }) => { if (!e.isDestroyed) onChange(e.getJSON()); } : undefined,
        editorProps: {
            attributes: {
                class: 'minimal-rich-editor-content prose prose-invert prose-sm max-w-none focus:outline-hidden min-h-[120px] p-3',
            },
        },
    });

    useEffect(() => {
        if (editor && !editor.isDestroyed) editor.setEditable(editable);
    }, [editor, editable]);

    useEffect(() => {
        if (!editor || editor.isDestroyed || !content || (typeof content === 'object' && Object.keys(content).length === 0)) return;
        // The editor's command/state managers can be momentarily unset while Tiptap
        // recreates the instance under React, and reading editor.commands then throws.
        // The initial content is already applied via useEditor's content option, so
        // skipping a transient sync is harmless.
        try {
            const current = editor.getJSON();
            if (JSON.stringify(current) !== JSON.stringify(content)) {
                editor.commands.setContent(content);
            }
        } catch { /* editor not ready yet — initial content stands */ }
    }, [content, editor]);

    if (!editor) return null;

    return (
        <div className="minimal-rich-editor">
            {editable && <MinimalToolbar editor={editor} />}
            <div className={`${editable ? 'border border-t-0 border-sky-500/30 bg-slate-900/50 rounded-b-lg' : 'border-transparent bg-transparent'}`}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default MinimalRichEditor;
