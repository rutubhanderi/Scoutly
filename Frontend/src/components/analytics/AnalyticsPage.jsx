import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import LoadingSpinner from '../LoadingSpinner';
import { TrendingUp, Target, Users, Check, Clock, Linkedin, Github } from 'lucide-react';
import api from '../../api';

// Reusable KPI Card Component (More Compact)
const KpiCard = ({ title, value, icon: Icon, unit = '' }) => (
  <motion.div
    whileHover={{ y: -3 }}
    className="bg-gray-800/50 border border-gray-700/80 rounded-xl p-4"
  >
    <div className="flex items-center gap-3">
      <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-md">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white">
          {value}{unit}
        </p>
      </div>
    </div>
  </motion.div>
);

// Sourcing Funnel Visualization
const SourcingFunnel = ({ data }) => {
  const funnelSteps = [
    { label: 'Sourced', value: data.sourced, color: 'bg-indigo-500' },
    { label: 'Saved', value: data.saved, color: 'bg-blue-500' },
    { label: 'Contacted', value: data.contacted, color: 'bg-sky-500' },
    { label: 'Hired', value: data.hired, color: 'bg-emerald-500' },
  ];

  const maxVal = Math.max(1, data.sourced);

  return (
    <div className="space-y-4">
      {funnelSteps.map((step, index) => {
        const width = (step.value / maxVal) * 100;
        const prevValue = index > 0 ? funnelSteps[index - 1].value : 0;
        const conversionRate = prevValue > 0 ? (step.value / prevValue * 100) : 100;

        return (
          <React.Fragment key={step.label}>
            {index > 0 && (
              <div className="flex justify-end pr-4">
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="font-mono">{conversionRate.toFixed(1)}%</span>
                  <span>↓</span>
                </div>
              </div>
            )}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${width}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`h-12 rounded-md ${step.color} flex items-center justify-between px-4 min-w-[120px]`}
              whileHover={{ filter: 'brightness(1.2)' }}
            >
              <span className="font-semibold text-white">{step.label}</span>
              <span className="font-bold text-white text-lg">{step.value}</span>
            </motion.div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Bar Chart for simple distributions
const BarChart = ({ data, labels }) => {
    const total = Object.values(data).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-4">
            {Object.entries(data).map(([key, value]) => {
                const percentage = total > 0 ? (value / total) * 100 : 0;
                return (
                    <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-300 capitalize">{labels[key]}</span>
                            <span className="text-sm font-semibold text-white">{value}</span>
                        </div>
                        <div className="flex-1 bg-gray-700/50 rounded-full h-2.5 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const AnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/fastapi/analytics');
        setData(response.data);
      } catch (err) {
        setError('Failed to load analytics data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Calculating analytics..." />;
  }

  if (error || !data) {
    return <div className="text-center py-20 text-red-400">{error || 'No data available.'}</div>;
  }

  const { kpis, funnel, source_effectiveness, score_distribution } = data;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6" // Reduced main vertical spacing
    >
      {/* KPIs Section */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4"> {/* Reduced gap */}
        <KpiCard title="Total Jobs" value={kpis.total_jobs} icon={Users} />
        <KpiCard title="Sourced" value={kpis.total_candidates_sourced} icon={TrendingUp} />
        <KpiCard title="Hires" value={kpis.total_hires} icon={Check} />
        <KpiCard title="Hire Rate" value={kpis.hire_rate} unit="%" icon={Target} />
        <KpiCard title="Avg. Time to Hire" value={kpis.avg_time_to_hire} unit=" days" icon={Clock} />
      </div>

      {/* Main Content Grid - Adjusted for better density */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sourcing Funnel (takes more space) */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Sourcing Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <SourcingFunnel data={funnel} />
          </CardContent>
        </Card>

        {/* Source Effectiveness */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Source Effectiveness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { platform: 'linkedin', ...source_effectiveness.linkedin, icon: Linkedin },
              { platform: 'github', ...source_effectiveness.github, icon: Github }
            ].map(source => (
              <div key={source.platform}>
                <div className="flex items-center gap-3 mb-3">
                  <source.icon className="w-6 h-6 text-gray-300" />
                  <h3 className="text-lg font-semibold text-white capitalize">{source.platform}</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center bg-gray-800/40 p-4 rounded-lg">
                  <div><p className="text-2xl font-bold text-blue-300">{source.sourced}</p><p className="text-xs text-gray-400">Sourced</p></div>
                  <div><p className="text-2xl font-bold text-blue-300">{source.avg_score}%</p><p className="text-xs text-gray-400">Avg. Score</p></div>
                  <div><p className="text-2xl font-bold text-blue-300">{source.hires}</p><p className="text-xs text-gray-400">Hires</p></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        {/* Match Score Distribution */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Match Score Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={score_distribution}
              labels={{
                excellent: "Excellent (90-100%)",
                good: "Good (75-89%)",
                fair: "Fair (60-74%)",
                low: "Low (<60%)"
              }}
            />
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default AnalyticsPage;