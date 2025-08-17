import { test, expect, Page } from '@playwright/test';
import { AITestHelpers } from '../helpers/ai-sidebar-helpers';

test.describe('AI Sidebar Knowledge Management Tests', () => {
    let page: Page;
    let helpers: AITestHelpers;

    test.beforeEach(async ({ page: p }) => {
        page = p;
        helpers = new AITestHelpers(page);
        await page.goto('/');
        await helpers.openSidebar();
        await page.click('[data-testid="notes-tab"]');
    });

    // Flow 50: Manual Knowledge Note Creation
    test(    // Flow 70: Knowledge Integration with Chat
        test('Flow 70: Reference knowledge notes in chat using /ref command', async () => {
            // Add some knowledge notes first
            await helpers.createKnowledgeNotes(['Solana consensus mechanism', 'DeFi protocols overview']);

            // Switch to chat tab
            await page.click('[data-testid="chat-tab"]');

            const input = page.locator('[data-testid="message-input"]');
            await expect(input).toBeVisible();

            // Type '/ref ' to trigger reference autocomplete
            await input.type('/ref ');

            const autocomplete = page.locator('[data-testid="reference-autocomplete"]');
            await expect(autocomplete).toBeVisible();

            // Should show available notes
            const referenceOptions = page.locator('[data-testid="reference-option"]');
            await expect(referenceOptions.first()).toContainText('Solana consensus');

            // Select a note
            await referenceOptions.first().click();

            // Input should contain the referenced note
            await expect(input).toHaveValue(/Referenced note.*Solana consensus/);
        });

    // Flow 50: Manual Knowledge Note Creation
    test('Flow 50: Create knowledge note manually with all fields', async () => {
        await page.click('[data-testid="add-entry-button"]');

        const noteForm = page.locator('[data-testid="note-creation-form"]');
        await expect(noteForm).toBeVisible();

        await noteForm.locator('[data-testid="note-title"]').fill('Solana Architecture');
        await noteForm.locator('[data-testid="note-content"]').fill('Solana uses Proof of History...');

        await noteForm.locator('[data-testid="save-note"]').click();

        const newNote = page.locator('[data-testid="knowledge-note"]').first();
        await expect(newNote).toBeVisible();
        await expect(newNote).toContainText('Solana Architecture');
        await expect(newNote.locator('[data-testid="note-timestamp"]')).toBeVisible();
        await expect(newNote.locator('[data-testid="note-id"]')).toHaveAttribute('data-id');
    });

    // Flow 51: Auto-Save from AI Response
    test('Flow 51: Save AI response directly to knowledge', async () => {
        await page.click('[data-testid="chat-tab"]');
        await helpers.sendMessage('Explain Solana consensus');
        await helpers.waitForAIResponse();

        const aiMessage = page.locator('[data-testid="ai-message"]').last();
        await aiMessage.hover();
        await aiMessage.locator('[data-testid="save-to-knowledge"]').click();

        await page.click('[data-testid="notes-tab"]');

        const savedNote = page.locator('[data-testid="knowledge-note"]').first();
        await expect(savedNote).toBeVisible();
        await expect(savedNote.locator('[data-testid="author-tag"]')).toHaveText('AI');
        await expect(savedNote).toContainText('consensus');
    });

    // Flow 52: Knowledge Note Search and Filter
    test('Flow 52: Search notes with multiple terms and operators', async () => {
        await helpers.createKnowledgeNotes([
            'Solana is fast',
            'DeFi protocols on Solana',
            'NFT marketplaces',
            'Ethereum comparison'
        ]);

        const searchInput = page.locator('[data-testid="knowledge-search"]');

        // Simple search
        await searchInput.fill('Solana');
        await expect(page.locator('[data-testid="knowledge-note"]:visible')).toHaveCount(2);
        await expect(page.locator('.search-highlight')).toHaveCount(2);

        // AND operator
        await searchInput.fill('Solana AND DeFi');
        await expect(page.locator('[data-testid="knowledge-note"]:visible')).toHaveCount(1);

        // OR operator
        await searchInput.fill('NFT OR Ethereum');
        await expect(page.locator('[data-testid="knowledge-note"]:visible')).toHaveCount(2);
    });

    // Flow 53: Knowledge Note Deletion
    test('Flow 53: Delete note with confirmation dialog', async () => {
        await helpers.createKnowledgeNotes(['Note to delete']);

        const note = page.locator('[data-testid="knowledge-note"]').first();
        await note.hover();
        await note.locator('[data-testid="delete-note"]').click();

        const confirmDialog = page.locator('[data-testid="confirm-deletion"]');
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText('Are you sure');

        await confirmDialog.locator('[data-testid="confirm-delete"]').click();
        await expect(note).not.toBeVisible();
    });

    // Flow 54: Bulk Knowledge Operations
    test('Flow 54: Select and perform bulk actions on notes', async () => {
        await helpers.createKnowledgeNotes(['Note 1', 'Note 2', 'Note 3', 'Note 4']);

        // Enable selection mode
        await page.click('[data-testid="bulk-select-mode"]');

        // Select multiple notes
        await page.click('[data-testid="note-checkbox-0"]');
        await page.click('[data-testid="note-checkbox-1"]');
        await page.click('[data-testid="note-checkbox-2"]');

        const bulkMenu = page.locator('[data-testid="bulk-actions-menu"]');
        await expect(bulkMenu).toBeVisible();
        await expect(bulkMenu).toContainText('3 selected');

        // Bulk delete
        await bulkMenu.locator('[data-testid="bulk-delete"]').click();
        await page.locator('[data-testid="confirm-bulk-delete"]').click();

        await expect(page.locator('[data-testid="knowledge-note"]')).toHaveCount(1);

        // Progress indicator shown during operation
        await expect(page.locator('[data-testid="bulk-operation-progress"]')).toHaveBeenVisible();
    });

    // Flow 55: Knowledge Note Categories/Tags
    test('Flow 55: Add and filter by tags', async () => {
        await helpers.createKnowledgeNoteWithTags('DeFi Content', ['defi', 'finance']);
        await helpers.createKnowledgeNoteWithTags('NFT Content', ['nft', 'art']);
        await helpers.createKnowledgeNoteWithTags('Trading Content', ['defi', 'trading']);

        // Tag autocomplete
        const tagInput = page.locator('[data-testid="tag-filter-input"]');
        await tagInput.type('de');
        await expect(page.locator('[data-testid="tag-suggestion"]')).toContainText('defi');

        // Filter by tag
        await page.click('[data-testid="tag-defi"]');
        await expect(page.locator('[data-testid="knowledge-note"]:visible')).toHaveCount(2);

        // Color-coded tags
        const defiTag = page.locator('[data-testid="tag-badge-defi"]').first();
        await expect(defiTag).toHaveCSS('background-color', /.+/);
    });

    // Flow 56: Knowledge Export Functionality
    test('Flow 56: Export all knowledge in different formats', async () => {
        await helpers.createKnowledgeNotes(['Export 1', 'Export 2', 'Export 3']);

        await page.click('[data-testid="export-knowledge"]');

        const exportDialog = page.locator('[data-testid="export-dialog"]');
        await expect(exportDialog).toBeVisible();

        // Test JSON export
        await exportDialog.locator('[data-testid="format-json"]').click();
        const jsonDownload = await helpers.waitForDownload();
        expect(jsonDownload.suggestedFilename()).toMatch(/knowledge-export.*\.json/);

        // Test CSV export
        await page.click('[data-testid="export-knowledge"]');
        await exportDialog.locator('[data-testid="format-csv"]').click();
        const csvDownload = await helpers.waitForDownload();
        expect(csvDownload.suggestedFilename()).toMatch(/knowledge-export.*\.csv/);

        // Test Markdown export
        await page.click('[data-testid="export-knowledge"]');
        await exportDialog.locator('[data-testid="format-markdown"]').click();
        const mdDownload = await helpers.waitForDownload();
        expect(mdDownload.suggestedFilename()).toMatch(/knowledge-export.*\.md/);
    });

    // Flow 57: Knowledge Import from File
    test('Flow 57: Import knowledge from file with preview', async () => {
        const importData = helpers.createKnowledgeExportFile([
            { title: 'Imported 1', content: 'Content 1' },
            { title: 'Imported 2', content: 'Content 2' }
        ]);

        await page.click('[data-testid="import-knowledge"]');

        const fileInput = page.locator('[data-testid="import-file-input"]');
        await fileInput.setInputFiles(importData);

        // Preview shows
        const preview = page.locator('[data-testid="import-preview"]');
        await expect(preview).toBeVisible();
        await expect(preview.locator('[data-testid="preview-item"]')).toHaveCount(2);

        await page.click('[data-testid="confirm-import"]');
        await expect(page.locator('[data-testid="knowledge-note"]')).toHaveCount(2);
    });

    // Flow 58: Knowledge Note Versioning
    test('Flow 58: Edit note and access version history', async () => {
        await helpers.createKnowledgeNotes(['Original content']);

        const note = page.locator('[data-testid="knowledge-note"]').first();
        await note.hover();
        await note.locator('[data-testid="edit-note"]').click();

        const editor = page.locator('[data-testid="note-editor"]');
        await editor.locator('[data-testid="note-content-editor"]').clear();
        await editor.locator('[data-testid="note-content-editor"]').fill('Updated content v2');
        await editor.locator('[data-testid="save-edit"]').click();

        // Access version history
        await note.hover();
        await note.locator('[data-testid="version-history"]').click();

        const versionPanel = page.locator('[data-testid="version-history-panel"]');
        await expect(versionPanel).toBeVisible();
        await expect(versionPanel.locator('[data-testid="version-item"]')).toHaveCount(2);

        // View diff
        await versionPanel.locator('[data-testid="view-diff"]').first().click();
        await expect(page.locator('[data-testid="diff-view"]')).toBeVisible();
        await expect(page.locator('.diff-removed')).toContainText('Original');
        await expect(page.locator('.diff-added')).toContainText('Updated');

        // Restore previous version
        await versionPanel.locator('[data-testid="restore-version"]').first().click();
        await expect(note).toContainText('Original content');
    });

    // Flow 59: Knowledge Sharing
    test('Flow 59: Share note with permission settings', async () => {
        await helpers.createKnowledgeNotes(['Share this knowledge']);

        const note = page.locator('[data-testid="knowledge-note"]').first();
        await note.hover();
        await note.locator('[data-testid="share-note"]').click();

        const shareDialog = page.locator('[data-testid="share-dialog"]');
        await expect(shareDialog).toBeVisible();

        // Set permissions
        await shareDialog.locator('[data-testid="permission-read-only"]').click();

        // Generate link
        await shareDialog.locator('[data-testid="generate-link"]').click();

        const shareLink = shareDialog.locator('[data-testid="share-link"]');
        await expect(shareLink).toHaveValue(/https:\/\/.+\/knowledge\/.+/);

        // Copy to clipboard
        await shareDialog.locator('[data-testid="copy-link"]').click();
        const clipboard = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboard).toMatch(/https:\/\/.+\/knowledge\/.+/);
    });

    // Flow 60: Knowledge Analytics
    test('Flow 60: View knowledge metrics and insights', async () => {
        await helpers.createKnowledgeNotes(['Note 1', 'Note 2', 'Note 3']);
        await helpers.createKnowledgeReferences(2); // Reference some notes

        await page.click('[data-testid="knowledge-analytics"]');

        const analyticsPanel = page.locator('[data-testid="analytics-panel"]');
        await expect(analyticsPanel).toBeVisible();

        // Timeline chart
        await expect(analyticsPanel.locator('[data-testid="creation-timeline"]')).toBeVisible();

        // Most referenced
        await expect(analyticsPanel.locator('[data-testid="most-referenced"]')).toBeVisible();
        await expect(analyticsPanel.locator('[data-testid="reference-count"]').first()).toHaveText('2');

        // Usage stats
        await expect(analyticsPanel.locator('[data-testid="total-notes"]')).toHaveText('3');
        await expect(analyticsPanel.locator('[data-testid="total-references"]')).toHaveText('2');

        // Insights
        await expect(analyticsPanel.locator('[data-testid="insight-recommendation"]')).toBeVisible();
    });

    // Flow 61: Knowledge Search Across Conversations
    test('Flow 61: Search knowledge with conversation context', async () => {
        // Create note from conversation
        await page.click('[data-testid="chat-tab"]');
        await helpers.sendMessage('Important fact about Solana');
        await helpers.waitForAIResponse();
        await helpers.saveMessageToKnowledge();

        // Search from knowledge panel
        await page.click('[data-testid="notes-tab"]');
        await page.fill('[data-testid="knowledge-search"]', 'Solana');

        const searchResult = page.locator('[data-testid="knowledge-note"]').first();
        await expect(searchResult.locator('[data-testid="conversation-context"]')).toBeVisible();

        // Jump to original conversation
        await searchResult.locator('[data-testid="view-in-context"]').click();
        await expect(page.locator('[data-testid="chat-tab"]')).toHaveClass(/active/);
        await expect(page.locator('[data-testid="highlighted-message"]')).toBeVisible();
    });

    // Flow 62: Knowledge Note Templates
    test('Flow 62: Create and use note templates', async () => {
        // Create template
        await page.click('[data-testid="templates-menu"]');
        await page.click('[data-testid="create-template"]');

        const templateForm = page.locator('[data-testid="template-form"]');
        await templateForm.locator('[data-testid="template-name"]').fill('Research Template');
        await templateForm.locator('[data-testid="template-content"]').fill('Topic: {{topic}}\nFindings: {{findings}}');
        await templateForm.locator('[data-testid="save-template"]').click();

        // Use template
        await page.click('[data-testid="add-entry-button"]');
        await page.click('[data-testid="use-template"]');
        await page.click('[data-testid="template-Research Template"]');

        const noteForm = page.locator('[data-testid="note-creation-form"]');
        await expect(noteForm.locator('[data-testid="note-content"]')).toHaveValue(/Topic:.*\nFindings:/);

        // Fill variables
        await noteForm.locator('[data-testid="variable-topic"]').fill('Solana DeFi');
        await noteForm.locator('[data-testid="variable-findings"]').fill('Growing ecosystem');

        await noteForm.locator('[data-testid="save-note"]').click();
        await expect(page.locator('[data-testid="knowledge-note"]').first()).toContainText('Solana DeFi');
    });

    // Flow 63: Knowledge Backup and Sync
    test('Flow 63: Enable cloud backup and test sync', async () => {
        await page.click('[data-testid="settings-button"]');
        await page.click('[data-testid="backup-settings"]');

        // Enable backup
        await page.click('[data-testid="enable-cloud-backup"]');
        await helpers.authenticateCloudService();

        // Create notes
        await helpers.createKnowledgeNotes(['Synced Note 1', 'Synced Note 2']);

        // Check sync status
        await expect(page.locator('[data-testid="sync-indicator"]')).toHaveClass(/synced/);

        // Simulate conflict
        await helpers.simulateConflictingChange();

        const conflictDialog = page.locator('[data-testid="conflict-resolution"]');
        await expect(conflictDialog).toBeVisible();
        await conflictDialog.locator('[data-testid="keep-local"]').click();

        // Restore from backup
        await page.click('[data-testid="restore-backup"]');
        await page.click('[data-testid="backup-point-1"]');
        await page.click('[data-testid="confirm-restore"]');

        await expect(page.locator('[data-testid="knowledge-note"]')).toHaveCount(2);
    });

    // Flow 64: Knowledge Note Linking
    test('Flow 64: Link notes and visualize connections', async () => {
        await helpers.createKnowledgeNotes(['Note A', 'Note B', 'Note C']);

        // Link notes
        const noteA = page.locator('[data-testid="knowledge-note"]').nth(0);
        await noteA.hover();
        await noteA.locator('[data-testid="link-note"]').click();

        const linkDialog = page.locator('[data-testid="link-dialog"]');
        await linkDialog.locator('[data-testid="select-note-1"]').click();
        await linkDialog.locator('[data-testid="link-type-relates-to"]').click();
        await linkDialog.locator('[data-testid="save-link"]').click();

        // Visualize connections
        await page.click('[data-testid="view-connections"]');

        const graphView = page.locator('[data-testid="knowledge-graph"]');
        await expect(graphView).toBeVisible();
        await expect(graphView.locator('[data-testid="graph-node"]')).toHaveCount(3);
        await expect(graphView.locator('[data-testid="graph-edge"]')).toHaveCount(1);

        // Navigate through connections
        await graphView.locator('[data-testid="graph-node-1"]').click();
        await expect(page.locator('[data-testid="knowledge-note"].selected')).toHaveAttribute('data-id', '1');
    });

    // Flow 65: Knowledge Full-Text Search
    test('Flow 65: Advanced full-text search with operators', async () => {
        await helpers.createKnowledgeNotes([
            'Solana performance metrics',
            'DeFi lending protocols',
            'Performance optimization for validators'
        ]);

        await page.click('[data-testid="advanced-search"]');

        const advancedSearch = page.locator('[data-testid="advanced-search-panel"]');
        await advancedSearch.locator('[data-testid="search-content"]').fill('performance');
        await advancedSearch.locator('[data-testid="exclude-terms"]').fill('DeFi');
        await advancedSearch.locator('[data-testid="date-range-start"]').fill('2023-01-01');

        await advancedSearch.locator('[data-testid="apply-search"]').click();

        await expect(page.locator('[data-testid="knowledge-note"]:visible')).toHaveCount(2);

        // Search result ranking
        const firstResult = page.locator('[data-testid="knowledge-note"]').first();
        await expect(firstResult).toContainText('performance');
        await expect(firstResult.locator('[data-testid="relevance-score"]')).toBeVisible();
    });

    // Flow 66: Knowledge Note Comments
    test('Flow 66: Add and manage comments on notes', async () => {
        await helpers.createKnowledgeNotes(['Note with comments']);

        const note = page.locator('[data-testid="knowledge-note"]').first();
        await note.hover();
        await note.locator('[data-testid="add-comment"]').click();

        // Add comment
        await page.fill('[data-testid="comment-input"]', 'This is a test comment');
        await page.click('[data-testid="submit-comment"]');

        // View comments
        await expect(note.locator('[data-testid="comment-count"]')).toHaveText('1');
        await note.locator('[data-testid="view-comments"]').click();

        const commentThread = page.locator('[data-testid="comment-thread"]');
        await expect(commentThread).toBeVisible();
        await expect(commentThread.locator('[data-testid="comment"]')).toHaveCount(1);

        // Reply to comment
        await commentThread.locator('[data-testid="reply-to-comment"]').click();
        await page.fill('[data-testid="reply-input"]', 'This is a reply');
        await page.click('[data-testid="submit-reply"]');

        // Thread expanded with reply
        await expect(commentThread.locator('[data-testid="comment-reply"]')).toBeVisible();
    });

    // Flow 67: Knowledge Note Attachments
    test('Flow 67: Add file attachments to knowledge notes', async () => {
        await helpers.createKnowledgeNotes(['Note with attachment']);

        const note = page.locator('[data-testid="knowledge-note"]').first();
        await note.hover();
        await note.locator('[data-testid="attach-file"]').click();

        // Upload file
        const fileInput = page.locator('[data-testid="file-input"]');
        await fileInput.setInputFiles({
            name: 'test-file.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('test content')
        });

        // File preview
        await expect(page.locator('[data-testid="file-preview"]')).toBeVisible();
        await expect(page.locator('[data-testid="file-name"]')).toHaveText('test-file.pdf');

        await page.click('[data-testid="confirm-attachment"]');

        // Attachment visible on note
        await expect(note.locator('[data-testid="attachment-icon"]')).toBeVisible();
        await note.locator('[data-testid="view-attachments"]').click();

        const attachmentList = page.locator('[data-testid="attachment-list"]');
        await expect(attachmentList).toBeVisible();
        await expect(attachmentList.locator('[data-testid="attachment-item"]')).toHaveCount(1);

        // Download attachment
        await attachmentList.locator('[data-testid="download-attachment"]').click();
        const download = await helpers.waitForDownload();
        expect(download.suggestedFilename()).toBe('test-file.pdf');
    });

    // Flow 68: Knowledge Note Reminders
    test('Flow 68: Set and manage reminders for notes', async () => {
        await helpers.createKnowledgeNotes(['Note with reminder']);

        const note = page.locator('[data-testid="knowledge-note"]').first();
        await note.hover();
        await note.locator('[data-testid="set-reminder"]').click();

        // Set reminder
        const reminderDialog = page.locator('[data-testid="reminder-dialog"]');
        await reminderDialog.locator('[data-testid="reminder-date"]').fill('2030-01-01');
        await reminderDialog.locator('[data-testid="reminder-time"]').fill('10:00');
        await reminderDialog.locator('[data-testid="reminder-recurring"]').click();
        await reminderDialog.locator('[data-testid="recurring-weekly"]').click();

        await reminderDialog.locator('[data-testid="save-reminder"]').click();

        // Reminder indicator
        await expect(note.locator('[data-testid="reminder-indicator"]')).toBeVisible();

        // View reminders
        await page.click('[data-testid="reminders-menu"]');
        const remindersList = page.locator('[data-testid="reminders-list"]');
        await expect(remindersList).toBeVisible();
        await expect(remindersList.locator('[data-testid="reminder-item"]')).toHaveCount(1);

        // Snooze reminder
        await remindersList.locator('[data-testid="snooze-reminder"]').click();
        await page.click('[data-testid="snooze-1-hour"]');
        await expect(remindersList.locator('[data-testid="snoozed-indicator"]')).toBeVisible();
    });

    // Flow 69: Knowledge Privacy Controls
    test('Flow 69: Set and manage note privacy levels', async () => {
        await helpers.createKnowledgeNotes(['Public note', 'Private note']);

        // Set privacy level
        const secondNote = page.locator('[data-testid="knowledge-note"]').nth(1);
        await secondNote.hover();
        await secondNote.locator('[data-testid="privacy-settings"]').click();

        const privacyDialog = page.locator('[data-testid="privacy-dialog"]');
        await privacyDialog.locator('[data-testid="private-option"]').click();
        await privacyDialog.locator('[data-testid="save-privacy"]').click();

        // Privacy indicators
        await expect(secondNote.locator('[data-testid="private-indicator"]')).toBeVisible();

        // Filter by privacy
        await page.click('[data-testid="filter-menu"]');
        await page.click('[data-testid="filter-private"]');
        await expect(page.locator('[data-testid="knowledge-note"]:visible')).toHaveCount(1);

        // Access control
        await secondNote.locator('[data-testid="access-control"]').click();
        const accessDialog = page.locator('[data-testid="access-dialog"]');
        await accessDialog.locator('[data-testid="add-user-input"]').fill('user@example.com');
        await accessDialog.locator('[data-testid="add-user"]').click();

        await expect(accessDialog.locator('[data-testid="access-user"]')).toHaveCount(1);
        await accessDialog.locator('[data-testid="save-access"]').click();
    });

    // Flow 70: Knowledge Integration with Chat
    test('Flow 70: Reference knowledge notes in chat', async () => {
        await helpers.createKnowledgeNotes(['Referenced note']);

        // Switch to chat
        await page.click('[data-testid="chat-tab"]');

        // Reference note in chat
        const input = page.locator('[data-testid="message-input"]');
        await input.type('/ref ');

        // Autocomplete
        const autocomplete = page.locator('[data-testid="reference-autocomplete"]');
        await expect(autocomplete).toBeVisible();
        await expect(autocomplete.locator('[data-testid="reference-suggestion"]')).toContainText('Referenced note');

        await autocomplete.locator('[data-testid="reference-suggestion"]').first().click();
        await expect(input).toHaveValue(/\[Referenced note\]\(#note-\d+\)/);

        // Send message with reference
        await page.press('[data-testid="message-input"]', 'Enter');

        // Reference appears in message
        const message = page.locator('[data-testid="user-message"]').last();
        await expect(message.locator('[data-testid="note-reference"]')).toBeVisible();

        // Click reference to view note
        await message.locator('[data-testid="note-reference"]').click();
        const notePreview = page.locator('[data-testid="note-preview"]');
        await expect(notePreview).toBeVisible();
        await expect(notePreview).toContainText('Referenced note');
    });

    // Flow 71: Knowledge Note Collaboration
    test('Flow 71: Real-time collaborative editing of notes', async () => {
        await helpers.createKnowledgeNotes(['Collaborative note']);

        // Enter collaborative mode
        const note = page.locator('[data-testid="knowledge-note"]').first();
        await note.hover();
        await note.locator('[data-testid="collaborative-edit"]').click();

        const collabEditor = page.locator('[data-testid="collaborative-editor"]');
        await expect(collabEditor).toBeVisible();

        // Generate sharing link
        await page.click('[data-testid="invite-collaborators"]');
        const shareUrl = await page.locator('[data-testid="collaboration-link"]').inputValue();

        // Simulate second user joining
        const page2 = await helpers.openSecondBrowser();
        await page2.goto(shareUrl);

        // Make edits as first user
        await collabEditor.locator('[data-testid="editor-content"]').fill('Updated by user 1');

        // See changes on second user's view
        await expect(page2.locator('[data-testid="editor-content"]')).toHaveValue('Updated by user 1');

        // User presence indicators
        await expect(page.locator('[data-testid="collaborator-indicator"]')).toHaveCount(2);
        await expect(page2.locator('[data-testid="collaborator-indicator"]')).toHaveCount(2);

        // View edit history
        await page.click('[data-testid="view-edit-history"]');
        const editHistory = page.locator('[data-testid="edit-history"]');
        await expect(editHistory).toBeVisible();
        await expect(editHistory.locator('[data-testid="edit-entry"]')).toHaveCount(1);
    });

    // Flow 72: Knowledge Data Visualization
    test('Flow 72: Visualize knowledge data with charts', async () => {
        // Create notes with different properties
        await helpers.createKnowledgeNotesWithMetadata(10);

        await page.click('[data-testid="knowledge-visualization"]');

        const visualizationPanel = page.locator('[data-testid="visualization-panel"]');
        await expect(visualizationPanel).toBeVisible();

        // Topic cluster view
        await visualizationPanel.locator('[data-testid="topic-clusters"]').click();
        await expect(visualizationPanel.locator('[data-testid="cluster-chart"]')).toBeVisible();

        // Time series view
        await visualizationPanel.locator('[data-testid="time-series"]').click();
        await expect(visualizationPanel.locator('[data-testid="time-chart"]')).toBeVisible();

        // Interactive filtering
        await visualizationPanel.locator('[data-testid="date-range-filter"]').click();
        await page.selectOption('[data-testid="date-range-select"]', 'last-month');

        // Chart updates dynamically
        await expect(visualizationPanel.locator('[data-testid="filtered-indicator"]')).toBeVisible();

        // Export visualization
        await visualizationPanel.locator('[data-testid="export-chart"]').click();
        const download = await helpers.waitForDownload();
        expect(download.suggestedFilename()).toMatch(/knowledge-chart-.*\.png/);
    });

    // Flow 73: Knowledge Note Quality Scoring
    test('Flow 73: Analyze and improve note quality', async () => {
        await helpers.createKnowledgeNotes(['Short incomplete note', 'Comprehensive detailed note with examples and references']);

        // Run quality analysis
        await page.click('[data-testid="analyze-quality"]');

        await page.waitForSelector('[data-testid="quality-analysis-complete"]');

        // View quality scores
        const qualityScores = page.locator('[data-testid="quality-scores"]');
        await expect(qualityScores).toBeVisible();

        // Check individual scores
        const notes = page.locator('[data-testid="knowledge-note"]');

        // Low quality note
        await expect(notes.nth(0).locator('[data-testid="quality-indicator"]')).toHaveClass(/low-quality/);
        await expect(notes.nth(0).locator('[data-testid="quality-score"]')).toHaveText(/[0-3]\/10/);

        // High quality note
        await expect(notes.nth(1).locator('[data-testid="quality-indicator"]')).toHaveClass(/high-quality/);
        await expect(notes.nth(1).locator('[data-testid="quality-score"]')).toHaveText(/[7-9]\/10/);

        // Improvement suggestions
        await notes.nth(0).locator('[data-testid="improve-note"]').click();
        const suggestions = page.locator('[data-testid="improvement-suggestions"]');
        await expect(suggestions).toBeVisible();
        await expect(suggestions.locator('[data-testid="suggestion-item"]')).toHaveCount.above(0);
    });

    // Flow 74: Knowledge Workflow Automation
    test('Flow 74: Set up automated workflows for knowledge management', async () => {
        await page.click('[data-testid="automation-settings"]');

        const automationPanel = page.locator('[data-testid="automation-panel"]');
        await expect(automationPanel).toBeVisible();

        // Create new workflow
        await automationPanel.locator('[data-testid="create-workflow"]').click();

        const workflowEditor = page.locator('[data-testid="workflow-editor"]');

        // Configure trigger
        await workflowEditor.locator('[data-testid="trigger-type"]').selectOption('new-message');
        await workflowEditor.locator('[data-testid="trigger-contains"]').fill('Solana');

        // Configure action
        await workflowEditor.locator('[data-testid="action-type"]').selectOption('create-note');
        await workflowEditor.locator('[data-testid="auto-tag"]').fill('solana,blockchain');

        await workflowEditor.locator('[data-testid="save-workflow"]').click();

        // Workflow appears in list
        await expect(automationPanel.locator('[data-testid="workflow-item"]')).toHaveCount(1);

        // Test workflow
        await page.click('[data-testid="chat-tab"]');
        await helpers.sendMessage('Solana is a high-performance blockchain');
        await helpers.waitForAIResponse();

        // Check note was created automatically
        await page.click('[data-testid="notes-tab"]');
        const autoNote = page.locator('[data-testid="knowledge-note"]').first();
        await expect(autoNote).toBeVisible();
        await expect(autoNote.locator('[data-testid="tag-badge-solana"]')).toBeVisible();
        await expect(autoNote.locator('[data-testid="automation-indicator"]')).toBeVisible();
    });
});
