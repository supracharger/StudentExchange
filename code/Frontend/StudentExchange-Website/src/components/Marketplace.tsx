import React, { useEffect, useState } from 'react';

interface Listing {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  datetime: string;
  email: string;
  first_name: string;
  last_name: string;
}

export default function Marketplace() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // Form state for creating a listing
  const [showForm, setShowForm] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [category, setCategory] = useState<string>('Books');
  const userId = 1;

  useEffect(() => {
    fetchListings();
  }, [selectedCategory]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const url = selectedCategory 
        ? `/api/listing?category=${encodeURIComponent(selectedCategory)}` 
        : '/api/listing';
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch listings');
      const data = await response.json();
      setListings(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          price: parseFloat(price),
          category,
          userId
        })
      });

      if (!response.ok) throw new Error('Failed to create listing');

      // Reset form and refresh list
      setTitle('');
      setDescription('');
      setPrice('');
      setShowForm(false);
      fetchListings();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Student Exchange Marketplace</h1>
        <button 
          onClick={() => setShowForm(!showForm)} 
          style={{ padding: '10px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {showForm ? 'Cancel' : '+ New Listing'}
        </button>
      </div>

      {/* Create Listing Form Modal/Section */}
      {showForm && (
        <form onSubmit={handleCreateListing} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', margin: '20px 0', border: '1px solid #ddd' }}>
          <h3>Create a New Listing</h3>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Price (\$)</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}>
                <option value="Books">Books</option>
                <option value="Electronics">Electronics</option>
                <option value="Furniture">Furniture</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <button type="submit" style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Submit Listing
          </button>
        </form>
      )}
      
      {/* Category Filter */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => setSelectedCategory('')} 
          style={{ marginRight: '10px', padding: '8px 12px', background: !selectedCategory ? '#007bff' : '#f0f0f0', color: !selectedCategory ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          All
        </button>
        <button 
          onClick={() => setSelectedCategory('Books')} 
          style={{ marginRight: '10px', padding: '8px 12px', background: selectedCategory === 'Books' ? '#007bff' : '#f0f0f0', color: selectedCategory === 'Books' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Books
        </button>
        <button 
          onClick={() => setSelectedCategory('Electronics')} 
          style={{ padding: '8px 12px', background: selectedCategory === 'Electronics' ? '#007bff' : '#f0f0f0', color: selectedCategory === 'Electronics' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Electronics
        </button>
      </div>

      {loading && <p>Loading listings...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!loading && !error && listings.length === 0 && (
        <p>No listings found.</p>
      )}

      {/* Listings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {listings.map((item) => (
          <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', background: '#fff' }}>
            <span style={{ fontSize: '12px', background: '#e9ecef', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
              {item.category}
            </span>
            <h3 style={{ margin: '12px 0 8px 0', fontSize: '18px' }}>{item.title}</h3>
            <p style={{ color: '#28a745', fontWeight: 'bold', fontSize: '16px' }}>\${item.price.toFixed(2)}</p>
            <p style={{ color: '#555', fontSize: '14px', minHeight: '40px' }}>{item.description}</p>
            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '12px 0' }} />
            <div style={{ fontSize: '12px', color: '#777' }}>
              Posted by: {item.first_name} {item.last_name} ({item.email})<br />
              {new Date(item.datetime).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}