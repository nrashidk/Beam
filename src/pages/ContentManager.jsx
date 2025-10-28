import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ArrowLeft, Save, Search, Edit2, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function ContentManager() {
  const navigate = useNavigate();
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [saving, setSaving] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    loadContent();
  }, []);

  async function loadContent() {
    try {
      setLoading(true);
      const response = await api.get('/admin/content');
      setContent(response.data);
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key) {
    try {
      setSaving(key);
      await api.put(`/admin/content/${key}`, { value: editValue });
      
      // Update local state
      setContent(content.map(block => 
        block.key === key ? { ...block, value: editValue, updated_at: new Date().toISOString() } : block
      ));
      
      setEditingKey(null);
      setEditValue('');
      setSuccessMessage(`Updated: ${key}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(null);
    }
  }

  function startEdit(block) {
    setEditingKey(block.key);
    setEditValue(block.value);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue('');
  }

  const sections = ['all', ...new Set(content.map(b => b.section).filter(Boolean))];
  
  const filteredContent = content.filter(block => {
    const matchesSearch = !searchQuery || 
      block.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (block.description && block.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesSection = sectionFilter === 'all' || block.section === sectionFilter;
    
    return matchesSearch && matchesSection;
  });

  // Group by section
  const groupedContent = filteredContent.reduce((acc, block) => {
    const section = block.section || 'uncategorized';
    if (!acc[section]) acc[section] = [];
    acc[section].push(block);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <p className="text-gray-600">Loading content...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/superadmin-dashboard')}>
              <ArrowLeft size={16} className="mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Content Manager</h1>
              <p className="text-sm text-gray-600">Edit all website text content</p>
            </div>
          </div>
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <Check size={16} />
              {successMessage}
            </div>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search by key, value, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map(section => (
                    <SelectItem key={section} value={section}>
                      {section === 'all' ? 'All Sections' : section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-gray-600">
                {filteredContent.length} blocks
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Blocks by Section */}
        {Object.entries(groupedContent).sort().map(([section, blocks]) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle className="text-lg capitalize">{section.replace(/_/g, ' ')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {blocks.map(block => (
                <div key={block.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-blue-600">{block.key}</span>
                        {block.updated_by && (
                          <span className="text-xs text-gray-500">
                            by {block.updated_by}
                          </span>
                        )}
                      </div>
                      {block.description && (
                        <p className="text-xs text-gray-600 mb-2">{block.description}</p>
                      )}
                      
                      {editingKey === block.key ? (
                        <div className="space-y-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(block.key)}
                              disabled={saving === block.key || editValue === block.value}
                            >
                              {saving === block.key ? (
                                'Saving...'
                              ) : (
                                <>
                                  <Check size={14} className="mr-1" />
                                  Save
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                              disabled={saving === block.key}
                            >
                              <X size={14} className="mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-md p-3 text-sm">
                          <p className="whitespace-pre-wrap">{block.value}</p>
                        </div>
                      )}
                    </div>
                    
                    {editingKey !== block.key && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(block)}
                        className="ml-4"
                      >
                        <Edit2 size={14} />
                      </Button>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Last updated: {new Date(block.updated_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {filteredContent.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-gray-600">
              No content blocks found matching your filters.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
