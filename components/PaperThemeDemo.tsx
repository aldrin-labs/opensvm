'use client';

import { useState } from 'react';

export const PaperThemeDemo = () => {
  const [sliderValue1, setSliderValue1] = useState(1000000);
  const [sliderValue2, setSliderValue2] = useState(8.79);
  const [sliderValue3, setSliderValue3] = useState(10000);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  // Handlers
  const handleSlider1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue1(Number(e.target.value));
  };

  const handleSlider2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue2(Number(e.target.value));
  };

  const handleSlider3Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue3(Number(e.target.value));
  };

  const toggleBreakdown = () => {
    setIsBreakdownOpen(!isBreakdownOpen);
  };

  // Calculate percentages for metrics
  const calculatePercentage = (value: number, max: number) => {
    return (value / max) * 100;
  };

  return (
    <div className="space-y-10">
      {/* Pricing Component */}
      <section>
        <h2 className="section-heading">Pricing Calculator</h2>
        
        <div className="card-modern">
          <div className="card-modern-header">
            <div className="card-modern-title">Document Storage & Processing</div>
          </div>
          
          <div className="slider-container">
            <div className="slider-label">
              <span>Storage</span>
              <span className="slider-value">${(sliderValue1 * 0.0000000022).toFixed(2)}/month</span>
            </div>
            <div className="subsection-label">per 1M docs</div>
            <div className="slider-track">
              <div 
                className="slider-progress" 
                style={{ width: `${calculatePercentage(sliderValue1, 2000000)}%` }}
              ></div>
              <div 
                className="slider-thumb"
                style={{ left: `${calculatePercentage(sliderValue1, 2000000)}%` }}
              ></div>
            </div>
            <input
              type="range"
              min="100000"
              max="2000000"
              step="100000"
              value={sliderValue1}
              onChange={handleSlider1Change}
              className="sr-only"
            />
            <div className="slider-ticks">
              {[100000, 500000, 1000000, 1500000, 2000000].map((value) => (
                <span key={value}>{value / 1000000}M</span>
              ))}
            </div>
          </div>
          
          <div className="slider-container">
            <div className="slider-label">
              <span>Writes</span>
              <span className="slider-value">${sliderValue2.toFixed(2)}</span>
            </div>
            <div className="subsection-label">per 1M docs</div>
            <div className="slider-track">
              <div 
                className="slider-progress" 
                style={{ width: `${calculatePercentage(sliderValue2, 15)}%` }}
              ></div>
              <div 
                className="slider-thumb"
                style={{ left: `${calculatePercentage(sliderValue2, 15)}%` }}
              ></div>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="0.01"
              value={sliderValue2}
              onChange={handleSlider2Change}
              className="sr-only"
            />
            <div className="slider-ticks">
              {[1, 5, 9, 12, 15].map((value) => (
                <span key={value}>${value}</span>
              ))}
            </div>
          </div>
          
          <div className="slider-container">
            <div className="slider-label">
              <span>Namespaces</span>
              <span className="slider-value">10K docs</span>
            </div>
            <div className="subsection-label">per namespace</div>
            <div className="slider-track">
              <div 
                className="slider-progress" 
                style={{ width: `${calculatePercentage(sliderValue3, 25000)}%` }}
              ></div>
              <div 
                className="slider-thumb"
                style={{ left: `${calculatePercentage(sliderValue3, 25000)}%` }}
              ></div>
            </div>
            <input
              type="range"
              min="1000"
              max="25000"
              step="1000"
              value={sliderValue3}
              onChange={handleSlider3Change}
              className="sr-only"
            />
            <div className="slider-ticks">
              {[1000, 5000, 10000, 15000, 25000].map((value) => (
                <span key={value}>{value / 1000}K</span>
              ))}
            </div>
          </div>
          
          <div className="mt-8">
            <p className="mb-2">A namespace is an isolated set of documents. Queries are cheaper and faster on smaller namespaces. We recommend putting each tenant or isolated workload in its own namespace.</p>
          </div>
          
          <div className="mt-6">
            <div className="price-item">
              <span className="price-label">Initial import</span>
              <span className="price-value">$6.66</span>
            </div>
            <div className="price-item">
              <span className="price-label">Estimated cost</span>
              <span className="price-value">$11.00 <span className="text-xs text-muted-foreground">per month</span></span>
            </div>
          </div>
          
          <div className="price-breakdown">
            <div className="price-breakdown-header" onClick={toggleBreakdown}>
              <span>Price breakdown</span>
              <span>{isBreakdownOpen ? '▲' : '▼'}</span>
            </div>
            {isBreakdownOpen && (
              <div className="mt-4 space-y-3">
                <div className="price-item">
                  <span className="price-label">Storage (1M docs)</span>
                  <span className="price-value">$2.20</span>
                </div>
                <div className="price-item">
                  <span className="price-label">Writes (1M docs)</span>
                  <span className="price-value">$8.79</span>
                </div>
                <div className="price-total">
                  <span>Total</span>
                  <span>$11.00</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* Performance Metrics */}
      <section>
        <h2 className="section-heading">Performance Metrics</h2>
        
        <div className="two-column-grid">
          <div className="card-modern">
            <div className="card-modern-header">
              <div className="card-modern-title">Warm Namespace</div>
            </div>
            
            <div className="performance-metrics">
              <div className="performance-metric">
                <span className="metric-label">p50</span>
                <div className="metric-bar-container">
                  <div className="metric-bar warm-metric" style={{ width: '25%' }}></div>
                  <span className="metric-bar-label">16ms</span>
                </div>
              </div>
              <div className="performance-metric">
                <span className="metric-label">p90</span>
                <div className="metric-bar-container">
                  <div className="metric-bar warm-metric" style={{ width: '35%' }}></div>
                  <span className="metric-bar-label">21ms</span>
                </div>
              </div>
              <div className="performance-metric">
                <span className="metric-label">p99</span>
                <div className="metric-bar-container">
                  <div className="metric-bar warm-metric" style={{ width: '50%' }}></div>
                  <span className="metric-bar-label">33ms</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card-modern">
            <div className="card-modern-header">
              <div className="card-modern-title">Cold Namespace</div>
            </div>
            
            <div className="performance-metrics">
              <div className="performance-metric">
                <span className="metric-label">p50</span>
                <div className="metric-bar-container">
                  <div className="metric-bar cold-metric" style={{ width: '60%' }}></div>
                  <span className="metric-bar-label">402ms</span>
                </div>
              </div>
              <div className="performance-metric">
                <span className="metric-label">p90</span>
                <div className="metric-bar-container">
                  <div className="metric-bar cold-metric" style={{ width: '80%' }}></div>
                  <span className="metric-bar-label">524ms</span>
                </div>
              </div>
              <div className="performance-metric">
                <span className="metric-label">p99</span>
                <div className="metric-bar-container">
                  <div className="metric-bar cold-metric" style={{ width: '95%' }}></div>
                  <span className="metric-bar-label">677ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-sm">
            Approach: 3 QPS with topk=10 for 10 minutes.
            <br />
            Reproduce with <a href="#" className="text-primary hover:underline">turbopuffer/tpef-benchmark</a>
          </p>
        </div>
      </section>
      
      {/* Testimonials */}
      <section>
        <h2 className="section-heading">Customer Testimonials</h2>
        
        <div className="two-column-grid">
          <div className="quote-card">
            <p className="quote-text">
              After switching our vector db to @turbopuffer, we're saving an order of magnitude in costs and dealing with far less complexity!
            </p>
            <div className="quote-author">
              <div className="author-avatar bg-gray-200"></div>
              <div className="author-info">
                <div className="author-name">Aman Sanger</div>
                <div className="author-title">Co-founder</div>
              </div>
              <div className="company-logo">CURSOR</div>
            </div>
            <div className="mt-4">
              <div className="stats-grid grid-cols-2">
                <div className="stat-card">
                  <div className="stat-label">Documents</div>
                  <div className="stat-value">30B+</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Namespaces</div>
                  <div className="stat-value">5M+</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="quote-card">
            <p className="quote-text">
              Moving to turbopuffer felt less like an upgrade and more like discovering a new paradigm. We didn't just save costs; we turned once-prohibitive features into standard tools in our arsenal. Vectorize all the things and say goodbye to sharding
            </p>
            <div className="quote-author">
              <div className="author-avatar bg-gray-200"></div>
              <div className="author-info">
                <div className="author-name">Justin Watts</div>
                <div className="author-title">Distinguished Engineer</div>
              </div>
              <div className="company-logo">TELUS</div>
            </div>
            <div className="mt-4">
              <div className="stats-grid grid-cols-1">
                <div className="stat-card">
                  <div className="stat-label">Deployment</div>
                  <div className="stat-value">Single-tenant cluster</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};