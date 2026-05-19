import axios from 'axios';

const API_URL = 'http://localhost:8000';

export const api = axios.create({
    baseURL: API_URL,
});

export const uploadResume = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const downloadResumeUrl = (resumeId: number) => {
    return `${API_URL}/download/${resumeId}`;
};

export const downloadResumeWithTemplateUrl = (resumeId: number, template: string) => {
    return `${API_URL}/download/${resumeId}?template=${encodeURIComponent(template)}`;
};

export const chatWithResume = async (resumeId: number, message: string, history: any[]) => {
    const response = await api.post('/chat/ask', { resume_id: resumeId, message, history });
    return response.data;
};

export const getDashboardStats = async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
};

export interface JobDescriptionPayload {
    title: string;
    description: string;
    required_skills: string[];
    company?: string;
    seniority?: string;
    industry?: string;
}

export const createJobDescription = async (payload: JobDescriptionPayload) => {
    const response = await api.post('/api/v1/job-descriptions', payload);
    return response.data;
};

export const getJobDescriptions = async () => {
    const response = await api.get('/api/v1/job-descriptions');
    return response.data;
};

export const getCandidates = async (search = '') => {
    const response = await api.get('/api/v1/candidates', { params: { search } });
    return response.data;
};


export const getMatchInsights = async (resumeId: number, jdId: number) => {
    const response = await api.post('/api/v1/match/insights', { resume_id: resumeId, jd_id: jdId });
    return response.data;
};

export const tailorResume = async (resumeId: number, jdId: number, instruction?: string, template = 'current') => {
    const response = await api.post(`/api/v1/resumes/${resumeId}/tailor`, {
        jd_id: jdId,
        instruction,
        template,
    });
    return response.data;
};


export const getInnovationLab = async (resumeId: number, jobDescription = "") => {
    const response = await api.post(`/api/v1/resumes/${resumeId}/innovation-lab`, {
        job_description: jobDescription,
    });
    return response.data;
};

export const getAuditLogs = async (params?: { sinceId?: number; limit?: number }) => {
    const response = await api.get('/api/v1/audit/logs', {
        params: {
            since_id: params?.sinceId,
            limit: params?.limit,
        },
    });
    return response.data;
};
