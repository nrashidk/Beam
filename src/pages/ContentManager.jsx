import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, Check, X, Edit2, FileText, Layout, Type, LayoutGrid, Sparkles } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

export default function ContentManager() {
  const navigate = useNavigate();
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
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
      // Failed to load content - error is displayed to user via empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key) {
    try {
      setSaving(key);
      const response = await api.put(`/admin/content/${key}`, { value: editValue });

      // Update local state
      setContent(content.map(block =>
        block.key === key ? { ...block, value: editValue, updated_at: new Date().toISOString() } : block
      ));

      setEditingKey(null);
      setEditValue('');
      setSuccessMessage(`✓ Saved: ${key.replace(/_/g, ' ')}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      alert(`Failed to save changes: ${error.response?.data?.detail || error.message}`);
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

  // Group content by section
  const contentBySection = {
    homepage: content.filter(b => b.section === 'homepage'),
    feature_boxes: content.filter(b => b.section === 'feature_boxes'),
    header: content.filter(b => b.section === 'header'),
    footer: content.filter(b => b.section === 'footer'),
  };

  function renderContentBlock(block) {
    const isEditing = editingKey === block.key;
    
    return (
      <div key={block.id} className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Key and Description */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 capitalize">
                  {block.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                {block.updated_by && (
                  <span className="text-xs text-gray-400 font-mono">
                    by {block.updated_by.split('@')[0]}
                  </span>
                )}
              </div>
              {block.description && (
                <p className="text-xs text-gray-500">{block.description}</p>
              )}
            </div>

            {/* Value Editor */}
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full border border-indigo-300 rounded-lg p-3 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-sans resize-y"
                  autoFocus
                  placeholder="Enter content..."
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(block.key)}
                    disabled={saving === block.key || editValue === block.value}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {saving === block.key ? (
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <>
                        <Check size={14} className="mr-1" />
                        Save Changes
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
                  <span className="text-xs text-gray-400 ml-2">
                    {editValue.length} characters
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                  {block.value || <span className="text-gray-400 italic">Empty</span>}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
              <span>Last updated: {new Date(block.updated_at).toLocaleString()}</span>
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{block.key}</span>
            </div>
          </div>

          {/* Edit Button */}
          {!isEditing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startEdit(block)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit2 size={16} className="text-indigo-600" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading content...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 min-h-screen">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/admin')}
                  className="hover:bg-indigo-50 hover:border-indigo-300"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Dashboard
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-indigo-600" size={24} />
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Content Manager
                    </h1>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Manage all website content in one place</p>
                </div>
              </div>
              
              {successMessage && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 text-green-700 px-5 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm animate-in slide-in-from-right">
                  <Check size={16} className="text-green-600" />
                  {successMessage}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="homepage" className="space-y-6">
            <TabsList className="bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
              <TabsTrigger 
                value="homepage" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg"
              >
                <FileText size={16} className="mr-2" />
                Homepage ({contentBySection.homepage.length})
              </TabsTrigger>
              <TabsTrigger 
                value="feature_boxes"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg"
              >
                <Layout size={16} className="mr-2" />
                Feature Boxes ({contentBySection.feature_boxes.length})
              </TabsTrigger>
              <TabsTrigger 
                value="header"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg"
              >
                <Type size={16} className="mr-2" />
                Header ({contentBySection.header.length})
              </TabsTrigger>
              <TabsTrigger 
                value="footer"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg"
              >
                <LayoutGrid size={16} className="mr-2" />
                Footer ({contentBySection.footer.length})
              </TabsTrigger>
            </TabsList>

            {/* Homepage Tab */}
            <TabsContent value="homepage" className="space-y-4">
              <Card className="border-none shadow-lg">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl">
                  <CardTitle className="flex items-center gap-2">
                    <FileText size={20} />
                    Homepage Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4 bg-white">
                  {contentBySection.homepage.length > 0 ? (
                    contentBySection.homepage.map(renderContentBlock)
                  ) : (
                    <p className="text-center text-gray-400 py-8">No homepage content found</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Feature Boxes Tab */}
            <TabsContent value="feature_boxes" className="space-y-4">
              <Card className="border-none shadow-lg">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl">
                  <CardTitle className="flex items-center gap-2">
                    <Layout size={20} />
                    Feature Boxes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4 bg-white">
                  {contentBySection.feature_boxes.length > 0 ? (
                    contentBySection.feature_boxes.map(renderContentBlock)
                  ) : (
                    <p className="text-center text-gray-400 py-8">No feature box content found</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Header Tab */}
            <TabsContent value="header" className="space-y-4">
              <Card className="border-none shadow-lg">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl">
                  <CardTitle className="flex items-center gap-2">
                    <Type size={20} />
                    Website Header
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4 bg-white">
                  {contentBySection.header.length > 0 ? (
                    contentBySection.header.map(renderContentBlock)
                  ) : (
                    <p className="text-center text-gray-400 py-8">No header content found</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Footer Tab */}
            <TabsContent value="footer" className="space-y-4">
              <Card className="border-none shadow-lg">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-xl">
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid size={20} />
                    Website Footer
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4 bg-white">
                  {contentBySection.footer.length > 0 ? (
                    contentBySection.footer.map(renderContentBlock)
                  ) : (
                    <p className="text-center text-gray-400 py-8">No footer content found</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Info Card */}
          <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <CardContent className="p-4">
              <p className="text-sm text-indigo-900">
                <strong>💡 Tip:</strong> After saving changes, you may need to refresh your browser 
                (Ctrl+Shift+R or Cmd+Shift+R) to see the updates on the live website.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
